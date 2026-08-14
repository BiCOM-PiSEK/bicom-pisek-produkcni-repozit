// netlify/functions/admin-booking-detail.js
// Detail rezervace s kompletně dešifrovanými PII a historií auditního logu.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { DataCrypt } from '../lib/datacrypt.js';

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

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Chybí ID rezervace.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const encryptionKey = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const crypt = new DataCrypt(encryptionKey);

    const [bookingRes, auditRes] = await Promise.all([
      supabase.from('bookings').select('*').eq('id', id).maybeSingle(),
      supabase.from('audit_log').select('*').eq('record_id', id).order('created_at', { ascending: false }),
    ]);

    if (!bookingRes.data) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Rezervace nebyla nalezena.' }),
        { status: 404, headers: CORS_HEADERS }
      );
    }

    const b = bookingRes.data;
    let name = '***', email = '***', phone = '***', note = null;

    try {
      [name, email, phone] = await Promise.all([
        crypt.decrypt(b.name_enc),
        crypt.decrypt(b.email_enc),
        crypt.decrypt(b.phone_enc),
      ]);
      if (b.note_enc) {
        note = await crypt.decrypt(b.note_enc);
      }
    } catch {
      console.warn(`[admin-booking-detail] Dešifrování selhalo pro rezervaci ${id}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        booking: {
          ...b,
          name,
          email,
          phone,
          note,
        },
        audit_trail: auditRes.data || [],
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[admin-booking-detail] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při načítání detailu rezervace.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/booking-detail',
};
