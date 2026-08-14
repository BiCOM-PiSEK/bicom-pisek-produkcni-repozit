// netlify/functions/admin-bookings.js
// Kompletní správa rezervací pro operátory Bicom Písek.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { DataCrypt } from '../lib/datacrypt.js';
import { confirmBooking, cancelBooking, recordAuditLog } from '../lib/db-supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  const supabase = getSupabaseAdmin();
  const encryptionKey = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const crypt = new DataCrypt(encryptionKey);

  // ─── GET: Výpis rezervací s filtry ─────────────────────────────
  if (request.method === 'GET') {
    try {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);
      const offset = Number(url.searchParams.get('offset')) || 0;

      let query = supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: rows, count, error } = await query;
      if (error) throw error;

      // Dešifrování
      const items = await Promise.all(
        (rows || []).map(async (row) => {
          try {
            const [name, email, phone, note] = await Promise.all([
              crypt.decrypt(row.name_enc),
              crypt.decrypt(row.email_enc),
              crypt.decrypt(row.phone_enc),
              row.note_enc ? crypt.decrypt(row.note_enc) : Promise.resolve(null),
            ]);
            return {
              ...row,
              name,
              email,
              phone,
              note,
            };
          } catch {
            return {
              ...row,
              name: '[Chyba dešifrování]',
              email: '***',
              phone: '***',
              note: null,
            };
          }
        })
      );

      return new Response(
        JSON.stringify({
          ok: true,
          bookings: items,
          total: count || 0,
          limit,
          offset,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error('[admin-bookings:get] Error:', err);
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání rezervací.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── POST: Změna stavu rezervace ───────────────────────────────
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { id, action, reason } = body;

      if (!id || !action) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Chybí ID rezervace nebo akce.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      if (action === 'confirm') {
        await confirmBooking(supabase, id, operator.id);
      } else if (action === 'cancel') {
        await cancelBooking(supabase, id, reason, operator.id);
      } else if (action === 'done') {
        await supabase.from('bookings').update({ status: 'done' }).eq('id', id);
        await recordAuditLog(supabase, 'bookings', id, 'update', `operator:${operator.id}`, 'Stav změněn na done (dokončeno)');
      } else {
        return new Response(
          JSON.stringify({ ok: false, error: `Neznámá akce: ${action}` }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, message: `Rezervace byla úspěšně aktualizována (${action}).` }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error('[admin-bookings:post] Error:', err);
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při aktualizaci rezervace.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: CORS_HEADERS,
  });
}

export const config = {
  path: '/admin/bookings',
};
