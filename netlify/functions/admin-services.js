// netlify/functions/admin-services.js
// Správa katalogu služeb a programů péče v administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { recordAuditLog } from '../lib/db-supabase.js';
import { deleteBlob } from '../lib/blobs.js';

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

  // ─── GET: Výpis všech služeb ───────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, services: services || [] }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání služeb.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── PUT / POST: Úprava nebo vytvoření služby ──────────────────
  if (request.method === 'PUT' || request.method === 'POST') {
    try {
      const body = await request.json();
      const { slug, name, category, segment, short_desc, long_desc, price_avg, price_note, sessions_typ, sort_order, is_active } = body;

      if (!slug || !name) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Slug a název služby jsou povinné.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const payload = {
        slug,
        name,
        category: category || 'prevence',
        segment: segment || 'vsichni',
        short_desc: short_desc || '',
        long_desc: long_desc || '',
        price_avg: price_avg != null ? Number(price_avg) : 1200,
        price_note: price_note || '',
        sessions_typ: sessions_typ || '1–3 sezení',
        sort_order: sort_order != null ? Number(sort_order) : 0,
        is_active: is_active !== false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('services').upsert(payload);
      if (error) throw error;

      // Invalidate Blobs cache
      await deleteBlob('services:all', 'bicom-cache');
      if (category) {
        await deleteBlob(`services:category:${category}`, 'bicom-cache');
      }

      await recordAuditLog(supabase, 'services', slug, request.method === 'POST' ? 'create' : 'update', `operator:${operator.id}`, `Služba ${name} upravena`);

      return new Response(
        JSON.stringify({ ok: true, message: 'Služba byla úspěšně uložena.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      console.error('[admin-services:save] Error:', err);
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při ukládání služby.', details: err.message }),
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
  path: '/admin/services',
};
