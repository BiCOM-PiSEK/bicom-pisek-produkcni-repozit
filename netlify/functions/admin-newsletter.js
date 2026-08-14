// netlify/functions/admin-newsletter.js
// Správa a přehled odběratelů newsletteru v administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const operator = await authenticateOperator(request);
  if (!operator) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Neautorizovaný přístup.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: subscribers, count, error } = await supabase
      .from('newsletter_subscribers')
      .select('id, email_hash, status, source, created_at', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        subscribers: subscribers || [],
        total: count || 0,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při načítání odběratelů.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/newsletter',
};
