// netlify/functions/admin-gallery.js
// Správa fotogalerie a multimediálních podkladů v administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { deleteBlob } from '../lib/blobs.js';
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

  // ─── GET: Výpis všech fotek ────────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('gallery_items')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, items: data || [] }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání fotogalerie.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── POST / PUT: Přidání nebo editace položky ───────────────────
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.json();
      const id = body.id || crypto.randomUUID();
      const payload = {
        id,
        title: body.title || 'Fotografie ordinace',
        alt_text: body.alt_text || 'Bicom Písek',
        category: body.category || 'ordinace',
        image_url: body.image_url,
        sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('gallery_items').upsert(payload);
      if (error) throw error;

      await deleteBlob('gallery:all', 'bicom-cache');
      await recordAuditLog(supabase, 'gallery_items', id, 'upsert', `operator:${operator.id}`, `Fotografie ${payload.title} uložena`);

      return new Response(
        JSON.stringify({ ok: true, message: 'Fotografie byla úspěšně uložena.', item: payload }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při ukládání fotografie.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── DELETE: Smazání fotky ─────────────────────────────────────
  if (request.method === 'DELETE') {
    try {
      const body = await request.json();
      const { id } = body;
      if (!id) {
        return new Response(JSON.stringify({ ok: false, error: 'Chybí ID položky.' }), { status: 400, headers: CORS_HEADERS });
      }

      await supabase.from('gallery_items').delete().eq('id', id);
      await deleteBlob('gallery:all', 'bicom-cache');
      await recordAuditLog(supabase, 'gallery_items', id, 'delete', `operator:${operator.id}`, `Fotografie ${id} smazána`);

      return new Response(
        JSON.stringify({ ok: true, message: 'Fotografie byla smazána.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při mazání fotografie.', details: err.message }),
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
  path: '/admin/gallery',
};
