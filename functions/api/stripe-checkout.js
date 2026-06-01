// POST /api/stripe-checkout
// Creates a pending booking and returns a Stripe Checkout Session URL.

import { DataCrypt } from '../lib/datacrypt.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    
    // Validate inputs
    if (!data.name || !data.email || !data.phone || !data.service || !data.preferred_date) {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'Vyplňte prosím všechna povinná pole.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    const bookingId = crypto.randomUUID();

    // 1. Encrypt sensitive fields
    const [nameEnc, emailEnc, phoneEnc, noteEnc] = await Promise.all([
      crypt.encrypt(data.name),
      crypt.encrypt(data.email),
      crypt.encrypt(data.phone),
      data.note ? crypt.encrypt(data.note) : Promise.resolve(null),
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
      `INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, estimated_price, status, stripe_session_id, stripe_payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, 'pending_payment')`
    ).bind(
      bookingId,
      nameEnc,
      emailEnc,
      phoneEnc,
      data.service,
      noteEnc,
      data.preferred_date,
      data.psc || null,
      data.estimated_price || null,
      session.id
    ).run();

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
