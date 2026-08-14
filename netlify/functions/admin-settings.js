// netlify/functions/admin-settings.js
// Správa nastavení rezervací a provozních výjimek pro operátory.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { recordAuditLog } from '../lib/db-supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

  // ─── GET: Načtení veškerých nastavení ─────────────────────────
  if (request.method === 'GET') {
    try {
      const [settingsRes, rulesRes, exceptionsRes] = await Promise.all([
        supabase.from('booking_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('availability_rules').select('*').order('weekday', { ascending: true }),
        supabase.from('availability_exceptions').select('*').order('date', { ascending: true }),
      ]);

      return new Response(
        JSON.stringify({
          ok: true,
          settings: settingsRes.data || {
            slot_duration_min: 60,
            slot_gap_min: 10,
            min_lead_hours: 24,
            max_horizon_days: 60,
          },
          rules: rulesRes.data || [],
          exceptions: exceptionsRes.data || [],
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání nastavení.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── PUT / POST: Úprava nastavení nebo přidání výjimky ─────────
  if (request.method === 'PUT' || request.method === 'POST') {
    try {
      const body = await request.json();

      // Úprava globálních parametrů
      if (body.settings) {
        await supabase
          .from('booking_settings')
          .upsert({ id: 1, ...body.settings, updated_at: new Date().toISOString() });
      }

      // Přidání výjimky (dovolená, svátek, mimořádná otevírací doba)
      if (body.exception) {
        const exc = body.exception;
        const id = exc.id || crypto.randomUUID();
        await supabase.from('availability_exceptions').upsert({
          id,
          date: exc.date,
          start_time: exc.start_time || null,
          end_time: exc.end_time || null,
          type: exc.type || 'vacation',
          note: exc.note || null,
        });
      }

      // Smazání výjimky
      if (body.delete_exception_id) {
        await supabase.from('availability_exceptions').delete().eq('id', body.delete_exception_id);
      }

      await recordAuditLog(supabase, 'booking_settings', '1', 'update', `operator:${operator.id}`, 'Nastavení rezervací upraveno');

      return new Response(
        JSON.stringify({ ok: true, message: 'Nastavení bylo úspěšně uloženo.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při ukládání nastavení.', details: err.message }),
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
  path: '/admin/settings',
};
