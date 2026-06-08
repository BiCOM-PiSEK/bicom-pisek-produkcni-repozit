// POST /api/book
// Creates a new booking, encrypts PII, stores in D1,
// and enqueues async processing (calendar, email, Telegram, reminders).

import { DataCrypt } from '../lib/datacrypt.js';
import { createBooking, addGeoLead, subscribeNewsletter, CONSENT_VERSION, parseBoolean } from '../lib/db.js';
import { checkRateLimit } from '../lib/rate-limit.js';

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

    // 2. Validate required fields
    const { name, email, phone, service, preferred_date, note, psc, consent_marketing, reminder_channel, consent_processing } = data;

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
    const preferredDate = new Date(preferred_date);
    if (isNaN(preferredDate.getTime()) || preferredDate <= new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zvolte prosím budoucí datum.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Init encryption
    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);

    // 4. Create booking in D1 (encrypts PII inside createBooking)
    const bookingId = await createBooking(env.DB, crypt, {
      name: cleanName,
      email,
      phone,
      service,
      preferred_date: preferredDate.toISOString(),
      note: cleanNote,
      psc: psc ? sanitize(psc) : null,
      consent_version: CONSENT_VERSION,
      consent_marketing: parsedConsentMarketing ? 1 : 0,
      reminder_channel: reminderChannel,
    });

    // 5. GEO lead tracking (non-blocking)
    if (psc) {
      waitUntil(
        addGeoLead(env.DB, sanitize(psc), service, 'web').catch((err) =>
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
    waitUntil(
      env.BOOKING_QUEUE.send({
        bookingId,
        name: cleanName,
        email,
        phone,
        service,
        preferred_date: preferredDate.toISOString(),
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
