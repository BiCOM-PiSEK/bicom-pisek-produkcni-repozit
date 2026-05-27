// POST /api/newsletter
// Subscribes an email to the newsletter list.
// Encrypts email before storing in D1.

import { DataCrypt } from '../lib/datacrypt.js';
import { subscribeNewsletter } from '../lib/db.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/newsletter — Subscribe to newsletter.
 */
export async function onRequestPost({ request, env }) {
  try {
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

    const { email } = data;

    // 2. Validate email
    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zadejte prosím platnou e-mailovou adresu.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 3. Init encryption and subscribe
    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    await subscribeNewsletter(env.DB, crypt, email, 'form');

    // 4. Return success
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[newsletter] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru. Zkuste to prosím později.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
