// POST /api/stripe-checkout
// Creates a pending booking and returns a Stripe Checkout Session URL.

import { DataCrypt } from '../lib/datacrypt.js';
import { subscribeNewsletter, CONSENT_VERSION, parseBoolean } from '../lib/db.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { getNowInPrague, parseLocalDate, addMinutes, addDays, formatDate, formatDateTime } from '../lib/time.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const data = await request.json();
    const ip = request.headers.get('CF-Connecting-IP') || null;
    const turnstileResult = await verifyTurnstile({
      env,
      token: data.turnstile_token,
      remoteIp: ip,
    });
    if (!turnstileResult.ok) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Bezpečnostní ověření selhalo. Potvrďte prosím, že nejste robot, a odešlete formulář znovu.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }
    
    // Validate inputs
    const {
      name,
      email,
      phone,
      service,
      preferred_date,
      note,
      psc,
      consent_marketing,
      reminder_channel,
      consent_processing,
      slot_start,
      slot_end
    } = data;

    if (!name || !email || !phone || !service || !preferred_date) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Vyplňte prosím všechna povinná pole.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!DATE_ONLY_REGEX.test(preferred_date)) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Neplatný formát data. Očekáváno YYYY-MM-DD.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let bookingSettings = {
      slot_duration_min: 60,
      min_lead_hours: 24,
      max_horizon_days: 60,
    };
    const settingsRow = await env.DB.prepare(
      'SELECT slot_duration_min, min_lead_hours, max_horizon_days FROM booking_settings WHERE id = 1'
    ).first();
    if (settingsRow) {
      bookingSettings = {
        slot_duration_min: settingsRow.slot_duration_min ?? 60,
        min_lead_hours: settingsRow.min_lead_hours ?? 24,
        max_horizon_days: settingsRow.max_horizon_days ?? 60,
      };
    }

    const preferredDate = parseLocalDate(preferred_date);
    if (formatDate(preferredDate) !== preferred_date) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Neplatné datum. Zvolte existující den.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const nowPrague = getNowInPrague();
    const todayPrague = new Date(nowPrague.getFullYear(), nowPrague.getMonth(), nowPrague.getDate(), 0, 0, 0, 0);
    const maxDatePrague = addDays(todayPrague, bookingSettings.max_horizon_days);
    if (preferredDate < todayPrague || preferredDate > maxDatePrague) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: `Zvolte prosím datum v horizontu ${bookingSettings.max_horizon_days} dní.` }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let validatedSlotStart = null;
    let validatedSlotEnd = null;
    if (slot_start) {
      const slotRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!slotRegex.test(slot_start)) {
        return new Response(
          JSON.stringify({ error: 'invalid_input', message: 'Chybný formát slot_start. Očekáno: YYYY-MM-DD HH:MM.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const [datePart, timePart] = slot_start.split(' ');
      if (datePart !== preferred_date) {
        return new Response(
          JSON.stringify({ error: 'invalid_input', message: 'Vybraný čas neodpovídá zvolenému dni rezervace.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const [y, mo, d] = datePart.split('-').map(Number);
      const [hh, mm] = timePart.split(':').map(Number);
      const slotDate = new Date(y, mo - 1, d, hh, mm, 0, 0);
      if (isNaN(slotDate.getTime())) {
        return new Response(
          JSON.stringify({ error: 'invalid_input', message: 'Neplatný slot_start — neexistující datum/čas.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const minLeadDate = addMinutes(nowPrague, bookingSettings.min_lead_hours * 60);
      if (slotDate < minLeadDate) {
        return new Response(
          JSON.stringify({ error: 'invalid_input', message: `Slot musí být nejméně ${bookingSettings.min_lead_hours} hodin v budoucnosti.` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let endDate;
      if (slot_end) {
        const endRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
        if (!endRegex.test(slot_end)) {
          return new Response(
            JSON.stringify({ error: 'invalid_input', message: 'Chybný formát slot_end. Očekáno: YYYY-MM-DD HH:MM.' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const [endDatePart, endTimePart] = slot_end.split(' ');
        const [ey, emo, ed] = endDatePart.split('-').map(Number);
        const [ehh, emm] = endTimePart.split(':').map(Number);
        endDate = new Date(ey, emo - 1, ed, ehh, emm, 0, 0);
        if (isNaN(endDate.getTime())) {
          return new Response(
            JSON.stringify({ error: 'invalid_input', message: 'Neplatný slot_end — neexistující datum/čas.' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        validatedSlotEnd = slot_end;
      } else {
        endDate = addMinutes(slotDate, bookingSettings.slot_duration_min);
        validatedSlotEnd = formatDateTime(endDate);
      }

      if (endDate <= slotDate) {
        return new Response(
          JSON.stringify({ error: 'invalid_input', message: 'Konec slotu musí být po jeho začátku.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      validatedSlotStart = slot_start;
    }

    // Strictly normalize boolean variables
    const parsedConsentProcessing = parseBoolean(consent_processing);
    const parsedConsentMarketing = parseBoolean(consent_marketing);
    const reminderChannel = reminder_channel || 'email';

    // Validate reminder_channel
    const validChannels = ['email', 'sms', 'whatsapp'];
    if (!validChannels.includes(reminderChannel)) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Neplatná volba komunikačního kanálu upomínek.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // WhatsApp is currently disabled at public API level
    if (reminderChannel === 'whatsapp') {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Kanál WhatsApp momentálně není podporován. Zvolte prosím SMS nebo E-mail.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Mandatory GDPR health processing consent
    if (!parsedConsentProcessing) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Pro vytvoření rezervace musíte udělit souhlas se zpracováním osobních a citlivých údajů.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    const bookingId = crypto.randomUUID();

    // 1. Encrypt sensitive fields
    const [nameEnc, emailEnc, phoneEnc, noteEnc] = await Promise.all([
      crypt.encrypt(name),
      crypt.encrypt(email),
      crypt.encrypt(phone),
      note ? crypt.encrypt(note) : Promise.resolve(null),
    ]);

    const depositAmount = 500; // 500 CZK deposit

    // 2. Call Stripe API to create Checkout Session
    const stripeSecret = env.SECRET_STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return new Response(
        JSON.stringify({ error: 'configuration_error', message: 'Platební brána není nakonfigurovaná.' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const stripeParams = new URLSearchParams();
    stripeParams.append('mode', 'payment');
    stripeParams.append('success_url', `${new URL(request.url).origin}/rezervace-potvrzena?id=${bookingId}`);
    stripeParams.append('cancel_url', `${new URL(request.url).origin}/rezervace-zrusena?id=${bookingId}`);
    stripeParams.append('metadata[bookingId]', bookingId);
    stripeParams.append('metadata[service]', data.service);
    stripeParams.append('line_items[0][price_data][currency]', 'czk');
    stripeParams.append('line_items[0][price_data][product_data][name]', `Rezervační záloha — Bicom`);
    stripeParams.append('line_items[0][price_data][product_data][description]', `${data.serviceName || data.service} (${new Date(data.preferred_date).toLocaleString('cs-CZ')})`);
    stripeParams.append('line_items[0][price_data][unit_amount]', String(depositAmount * 100)); // Stripe unit amount in cents
    stripeParams.append('line_items[0][quantity]', '1');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    });

    if (!stripeRes.ok) {
      const stripeError = await stripeRes.text();
      console.error('[stripe-checkout] Stripe API error:', stripeError);
      return new Response(
        JSON.stringify({ error: 'stripe_error', message: 'Nepodařilo se inicializovat platbu.' }),
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const session = await stripeRes.json();

    // 3. Save pending_payment booking to D1 database
    try {
      await env.DB.prepare(
        `INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, slot_start, slot_end, psc, estimated_price, consent_version, consent_marketing, reminder_channel, status, stripe_session_id, stripe_payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, 'pending_payment')`
      ).bind(
        bookingId,
        nameEnc,
        emailEnc,
        phoneEnc,
        service,
        noteEnc,
        preferredDate.toISOString(),
        validatedSlotStart,
        validatedSlotEnd,
        psc || null,
        data.estimated_price || null,
        CONSENT_VERSION,
        parsedConsentMarketing ? 1 : 0,
        reminderChannel,
        session.id
      ).run();
    } catch (dbErr) {
      const msg = String(dbErr?.message || '');
      const isSlotCollision = msg.includes('UNIQUE') &&
        (msg.includes('idx_bookings_slot_unique') || msg.includes('slot_start'));
      if (isSlotCollision) {
        return new Response(
          JSON.stringify({ error: 'slot_taken', message: 'Tento čas byl mezitím obsazen. Vyberte prosím jiný slot.' }),
          { status: 409, headers: CORS_HEADERS }
        );
      }
      throw dbErr;
    }

    // 4. Newsletter subscription (non-blocking)
    if (parsedConsentMarketing) {
      waitUntil(
        subscribeNewsletter(env.DB, crypt, email, 'booking').catch((err) =>
          console.error('[stripe-checkout] Newsletter subscribe error:', err)
        )
      );
    }

    return new Response(
      JSON.stringify({ url: session.url, bookingId }),
      { status: 200, headers: CORS_HEADERS }
    );

  } catch (err) {
    console.error('[stripe-checkout] Server error:', err);
    return new Response(
      JSON.stringify({ error: 'server_error', message: 'Interní chyba serveru.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
