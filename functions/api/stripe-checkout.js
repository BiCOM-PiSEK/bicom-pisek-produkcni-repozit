// POST /api/stripe-checkout
// Creates a pending booking and returns a Stripe Checkout Session URL.

import { DataCrypt } from '../lib/datacrypt.js';
import { subscribeNewsletter, CONSENT_VERSION, parseBoolean } from '../lib/db.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const data = await request.json();
    
    // Validate inputs
    const { name, email, phone, service, preferred_date, note, psc, consent_marketing, reminder_channel, consent_processing } = data;

    if (!name || !email || !phone || !service || !preferred_date) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Vyplňte prosím všechna povinná pole.' }),
        { status: 400, headers: CORS_HEADERS }
      );
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
    await env.DB.prepare(
      `INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, estimated_price, consent_version, consent_marketing, reminder_channel, status, stripe_session_id, stripe_payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, 'pending_payment')`
    ).bind(
      bookingId,
      nameEnc,
      emailEnc,
      phoneEnc,
      service,
      noteEnc,
      preferred_date,
      psc || null,
      data.estimated_price || null,
      CONSENT_VERSION,
      parsedConsentMarketing ? 1 : 0,
      reminderChannel,
      session.id
    ).run();

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
