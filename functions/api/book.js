// POST /api/book
// Creates a new booking, encrypts PII, stores in D1,
// and enqueues async processing (calendar, email, Telegram, reminders).

import { DataCrypt } from '../lib/datacrypt.js';
import { addGeoLead, subscribeNewsletter, CONSENT_VERSION, parseBoolean } from '../lib/db.js';
import { buildGeoLeadMeta } from '../lib/geo.js';
import { checkRateLimit } from '../lib/rate-limit.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { getNowInPrague, parseLocalDate, addMinutes, addDays, formatDate, formatDateTime } from './availability.js';

// Allowed service slugs — keep in sync with db/seed/services.sql
const ALLOWED_SERVICES = [
  'imunita-a-obranyschopnost',
  'energie-a-vitalita',
  'bolest-a-pohybovy-aparat',
  'psychika-a-emocni-rovnovaha',
  'hormonalni-system',
  'metabolismus',
  'organy-a-detoxikace',
  'patogeny',
  'prostredi-a-zateze',
  'podpora-pri-onkologii',
  'prevence-a-rekonvalescence',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+420\d{9}$/;
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Strips HTML tags from a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/book — Create a new booking.
 */
export async function onRequestPost({ request, env, waitUntil }) {
  try {
    // 0. Rate limiting (max 5 bookings per IP per minute)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(env.CACHE, ip, 'book', 5);
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Příliš mnoho požadavků. Zkuste to prosím za minutu.' }),
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // 1. Parse JSON body
    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát požadavku.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const turnstileResult = await verifyTurnstile({
      env,
      token: data.turnstile_token,
      remoteIp: ip !== 'unknown' ? ip : null,
    });
    if (!turnstileResult.ok) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bezpečnostní ověření selhalo. Potvrďte prosím, že nejste robot, a odešlete formulář znovu.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 2. Load booking settings (F6: configurability)
    let bookingSettings = {
      require_confirmation: false,
      require_deposit: false,
      deposit_amount: null,
      slot_duration_min: 60,
      min_lead_hours: 24,
      max_horizon_days: 60,
    };
    try {
      const settingsRow = await env.DB.prepare('SELECT * FROM booking_settings WHERE id = 1').first();
      if (settingsRow) {
        bookingSettings = {
          require_confirmation: Boolean(settingsRow.require_confirmation),
          require_deposit: Boolean(settingsRow.require_deposit),
          deposit_amount: settingsRow.deposit_amount ?? null,  // #5: ?? aby 0 nebyl přepsán
          slot_duration_min: settingsRow.slot_duration_min ?? 60,
          min_lead_hours: settingsRow.min_lead_hours ?? 24,
          max_horizon_days: settingsRow.max_horizon_days ?? 60,
        };
      }
    } catch (err) {
      console.warn('[book] Could not load booking_settings, using defaults:', err);
    }

    // Sjednocení s veřejným configem (process_states) pro povinnou Stripe zálohu
    try {
      const depositToggleRow = await env.DB.prepare(
        "SELECT value FROM process_states WHERE key = 'stripe_deposit_required'"
      ).first();
      if (depositToggleRow && (depositToggleRow.value === '0' || depositToggleRow.value === '1')) {
        bookingSettings.require_deposit = depositToggleRow.value === '1';
      }
    } catch (err) {
      console.warn('[book] Could not load stripe_deposit_required process_state:', err);
    }

    // 2. Validate required fields
    const { name, email, phone, service, preferred_date, note, psc, consent_marketing, reminder_channel, consent_processing, slot_start, slot_end } = data;

    if (!name || !email || !phone || !service || !preferred_date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyplňte prosím všechna povinná pole.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Strictly normalize boolean variables
    const parsedConsentProcessing = parseBoolean(consent_processing);
    const parsedConsentMarketing = parseBoolean(consent_marketing);
    const reminderChannel = reminder_channel || 'email';

    // Validate reminder_channel before writing
    const validChannels = ['email', 'sms', 'whatsapp'];
    if (!validChannels.includes(reminderChannel)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatná volba komunikačního kanálu upomínek.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // WhatsApp is currently disabled at public API level
    if (reminderChannel === 'whatsapp') {
      return new Response(
        JSON.stringify({ success: false, error: 'Kanál WhatsApp momentálně není podporován. Zvolte prosím SMS nebo E-mail.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Mandatory GDPR health processing consent
    if (!parsedConsentProcessing) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pro vytvoření rezervace musíte udělit souhlas se zpracováním osobních a citlivých údajů.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Sanitize text inputs
    const cleanName = sanitize(name);
    const cleanNote = note ? sanitize(note) : null;

    if (!EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát e-mailové adresy.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!PHONE_REGEX.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát telefonu. Použijte +420XXXXXXXXX.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!ALLOWED_SERVICES.includes(service)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatná služba.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Validate preferred_date is a valid future date
    if (!DATE_ONLY_REGEX.test(preferred_date)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát data. Očekáváno YYYY-MM-DD.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const preferredDate = parseLocalDate(preferred_date);
    if (formatDate(preferredDate) !== preferred_date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatné datum. Zvolte existující den.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowPrague = getNowInPrague();
    const todayPrague = new Date(nowPrague.getFullYear(), nowPrague.getMonth(), nowPrague.getDate(), 0, 0, 0, 0);
    const maxDatePrague = addDays(todayPrague, bookingSettings.max_horizon_days);
    if (preferredDate < todayPrague || preferredDate > maxDatePrague) {
      return new Response(
        JSON.stringify({ success: false, error: `Zvolte prosím datum v horizontu ${bookingSettings.max_horizon_days} dní.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // F6: Validate slot_start if provided (zpětná kompatibilita: slot_start je volitelný)
    // OPRAVA #1: Časová zóna — konzistentní s F2 (getNowInPrague, parseLocalDate)
    let validatedSlotStart = null;
    let validatedSlotEnd = null;
    if (slot_start) {
      const slotRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!slotRegex.test(slot_start)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Chybný formát slot_start. Očekáno: YYYY-MM-DD HH:MM.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Parsuj slot_start v čase Praha (ne UTC)
      const [datePart, timePart] = slot_start.split(' ');
      const [y, mo, d] = datePart.split('-').map(Number);
      const [hh, mm] = timePart.split(':').map(Number);
      const slotDate = new Date(y, mo - 1, d, hh, mm, 0, 0);

      if (isNaN(slotDate.getTime())) {
        return new Response(
          JSON.stringify({ success: false, error: 'Neplatný slot_start — neexistující datum/čas.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (datePart !== preferred_date) {
        return new Response(
          JSON.stringify({ success: false, error: 'Vybraný čas neodpovídá zvolenému dni rezervace.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      // Ověř min_lead_hours v čase Praha (konzistentní s F2)
      const minLeadDate = addMinutes(nowPrague, bookingSettings.min_lead_hours * 60);

      if (slotDate < minLeadDate) {
        return new Response(
          JSON.stringify({ success: false, error: `Slot musí být nejméně ${bookingSettings.min_lead_hours} hodin v budoucnosti.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      validatedSlotStart = slot_start;
      // slot_end: pokud chybí, defaultně +60 minut
      let endDate;
      if (slot_end) {
        const endRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
        if (!endRegex.test(slot_end)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Chybný formát slot_end. Očekáno: YYYY-MM-DD HH:MM.' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        // Parsuj slot_end stejně jako slot_start (Praha, komponenty)
        const [endDatePart, endTimePart] = slot_end.split(' ');
        const [ey, emo, ed] = endDatePart.split('-').map(Number);
        const [ehh, emm] = endTimePart.split(':').map(Number);
        endDate = new Date(ey, emo - 1, ed, ehh, emm, 0, 0);
        validatedSlotEnd = slot_end;
      } else {
        // Default: podle slot_duration_min z booking_settings
        endDate = addMinutes(slotDate, bookingSettings.slot_duration_min);
        validatedSlotEnd = formatDateTime(endDate);
      }

      // #6: Validace slot_end > slot_start
      if (endDate <= slotDate) {
        return new Response(
          JSON.stringify({ success: false, error: 'Konec slotu musí být po jeho začátku.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // 3. Init encryption
    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);

    // 4. Encrypt PII
    let bookingId;
    try {
      const [nameEnc, emailEnc, phoneEnc, noteEnc, emailHash] = await Promise.all([
        crypt.encrypt(cleanName),
        crypt.encrypt(email),
        crypt.encrypt(phone),
        cleanNote ? crypt.encrypt(cleanNote) : Promise.resolve(null),
        DataCrypt.hash(email.toLowerCase().trim()),
      ]);

      // Determine status based on booking_settings (F6)
      let status = 'pending';
      if (bookingSettings.require_deposit) {
        status = 'pending_payment';
      } else if (bookingSettings.require_confirmation) {
        status = 'pending';
      }

      // 5. Insert into D1 with slot_start/end (F6) + UNIQUE collision handling
      bookingId = crypto.randomUUID();
      try {
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, slot_start, slot_end, psc, estimated_price, consent_version, consent_marketing, reminder_channel, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            bookingId, nameEnc, emailEnc, phoneEnc, service, noteEnc,
            preferredDate.toISOString(), validatedSlotStart, validatedSlotEnd,
            psc ? sanitize(psc) : null, null, CONSENT_VERSION,
            parsedConsentMarketing ? 1 : 0, reminderChannel, status
          ),
          env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'bookings', ?, 'create', 'system', ?)`
          ).bind(crypto.randomUUID(), bookingId, `Created booking, status: ${status}, slot_start: ${validatedSlotStart || 'none'}`),
        ]);
      } catch (dbErr) {
        // OPRAVA #2: UNIQUE collision detection — zpřísnit na slot_start index
        const msg = String(dbErr?.message || '');
        const isSlotCollision = msg.includes('UNIQUE') &&
          (msg.includes('idx_bookings_slot_unique') || msg.includes('slot_start'));
        if (isSlotCollision) {
          return new Response(
            JSON.stringify({ success: false, error: 'Tento čas byl mezitím obsazen. Vyberte prosím jiný slot.' }),
            { status: 409, headers: CORS_HEADERS }
          );
        }
        throw dbErr;
      }
    } catch (err) {
      console.error('[book] Encryption or booking creation error:', err);
      return new Response(
        JSON.stringify({ success: false, error: 'Interní chyba serveru. Zkuste to prosím později.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    // 5. GEO lead tracking (non-blocking)
    const sanitizedPsc = psc ? sanitize(psc) : null;
    const geoMeta = buildGeoLeadMeta(request, sanitizedPsc, Number.parseInt(env.H3_RESOLUTION || '8', 10));

    if (sanitizedPsc || geoMeta.city || (geoMeta.latitude != null && geoMeta.longitude != null)) {
      waitUntil(
        addGeoLead(env.DB, sanitizedPsc, service, 'web', geoMeta).catch((err) =>
          console.error('[book] GEO lead error:', err)
        )
      );
    }

    // 6. Newsletter subscription (non-blocking)
    if (parsedConsentMarketing) {
      waitUntil(
        subscribeNewsletter(env.DB, crypt, email, 'booking').catch((err) =>
          console.error('[book] Newsletter subscribe error:', err)
        )
      );
    }

    // 7. Enqueue async processing (calendar, email, Telegram, reminders)
    // F6: Rozšíření o slot_start/slot_end pro přesný čas v kalendáři a mailech
    waitUntil(
      env.BOOKING_QUEUE.send({
        bookingId,
        name: cleanName,
        email,
        phone,
        service,
        preferred_date: preferredDate.toISOString(),
        slot_start: validatedSlotStart,
        slot_end: validatedSlotEnd,
        note: cleanNote,
        reminder_channel: reminderChannel,
      }).catch((err) => console.error('[book] Queue send error:', err))
    );

    // 8. Return success
    return new Response(
      JSON.stringify({ success: true, bookingId }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[book] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru. Zkuste to prosím později.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
