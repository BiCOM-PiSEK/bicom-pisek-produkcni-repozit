import { DataCrypt } from '../lib/datacrypt.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { subscribeNewsletter } from '../lib/db-supabase.js';
import { sanitizeHtml } from '../lib/sanitize.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const body = await request.json();
    const email = (body.email || '').toLowerCase().trim();
    const source = sanitizeHtml(body.source || 'web_footer').trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zadejte prosím platnou e-mailovou adresu.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const encryptionKey = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const crypt = new DataCrypt(encryptionKey);
    const supabase = getSupabaseAdmin();

    const id = await subscribeNewsletter(supabase, crypt, email, source);

    return new Response(
      JSON.stringify({
        success: true,
        id,
        message: 'Byli jste úspěšně přihlášeni k odběru novinek.',
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[api/newsletter] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Chyba při přihlášení k newsletteru.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/newsletter',
};
