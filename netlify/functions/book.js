// POST /api/book — Netlify Function
// Vytvoří novou rezervaci v Supabase s šifrováním PII a spustí asynchronní procesor.

import { DataCrypt } from '../lib/datacrypt.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { createBooking, subscribeNewsletter, createGeoLead, CONSENT_VERSION, parseBoolean } from '../lib/db-supabase.js';
import { sanitizeHtml } from '../lib/sanitize.js';
import { extractEdgeGeo, toH3Cell } from '../lib/geo.js';
import { verifyTurnstile } from '../lib/turnstile.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+420)?\s*[0-9]{3}\s*[0-9]{3}\s*[0-9]{3}$/;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát JSON těla.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Turnstile ověření (pokud je token poskytnut)
    if (data.turnstile_token) {
      const turnstileRes = await verifyTurnstile({
        env: process.env,
        token: data.turnstile_token,
      });
      if (!turnstileRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Bezpečnostní ověření Turnstile selhalo.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    // Validace povinných polí
    const name = sanitizeHtml(data.name || '').trim();
    const email = (data.email || '').toLowerCase().trim();
    const rawPhone = (data.phone || '').replace(/\s+/g, '');
    const phone = rawPhone.startsWith('+420') ? rawPhone : (rawPhone.length === 9 ? `+420${rawPhone}` : rawPhone);
    const service = sanitizeHtml(data.service || '').trim();
    const preferredDate = sanitizeHtml(data.preferred_date || data.slot_start || '').trim();
    const note = sanitizeHtml(data.note || '').trim();
    const psc = (data.psc || '').replace(/\s+/g, '');
    const consentMarketing = parseBoolean(data.consent_marketing);

    if (!name || name.length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyplňte prosím platné jméno a příjmení.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyplňte prosím platnou e-mailovou adresu.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!phone || !PHONE_REGEX.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyplňte prosím platné 9místné české telefonní číslo.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!service) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyberte požadovanou službu nebo program péče.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!preferredDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vyberte preferovaný termín nebo časový slot.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Šifrování citlivých údajů
    const encryptionKey = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const crypt = new DataCrypt(encryptionKey);
    const supabase = getSupabaseAdmin();

    // 1. Vytvoření rezervace v Supabase
    const bookingId = await createBooking(supabase, crypt, {
      name,
      email,
      phone,
      service,
      preferred_date: preferredDate,
      note: note || null,
      psc: psc || null,
      consent_version: CONSENT_VERSION,
      consent_marketing: consentMarketing,
      reminder_channel: 'email',
    });

    // 2. Newsletter (pokud udělen marketingový souhlas)
    if (consentMarketing) {
      try {
        await subscribeNewsletter(supabase, crypt, email, 'booking');
      } catch (err) {
        console.warn('[api/book] Newsletter subscribe error:', err.message);
      }
    }

    // 3. Geo Lead (pro lokální analytiku poptávek)
    try {
      const geo = extractEdgeGeo(request);
      const h3 = geo.latitude && geo.longitude ? toH3Cell(geo.latitude, geo.longitude) : null;
      await createGeoLead(supabase, {
        psc: psc || geo.postalCode,
        city: geo.city,
        service,
        source: 'booking_form',
        latitude: geo.latitude,
        longitude: geo.longitude,
        h3_hexagon_id: h3,
        country_code: geo.country || 'CZ',
      });
    } catch (err) {
      console.warn('[api/book] Geo lead recording error:', err.message);
    }

    // 4. Asynchronní spuštění Background processoru (Resend e-mail + Google Calendar + Telegram)
    try {
      const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://bicompisek.cz';
      fetch(`${siteUrl}/.netlify/functions/booking-process-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          name,
          email,
          phone,
          service,
          preferred_date: preferredDate,
          note,
        }),
      }).catch((err) => console.warn('[api/book] Background trigger error:', err.message));
    } catch (err) {
      console.warn('[api/book] Async dispatch failed:', err.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: bookingId,
        message: 'Rezervace byla úspěšně přijata. Děkujeme, brzy se vám ozveme.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[api/book] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Došlo k neočekávané chybě při zpracování rezervace.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/book',
};
