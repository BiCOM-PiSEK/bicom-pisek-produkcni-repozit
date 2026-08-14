// netlify/functions/admin-hero.js
// Správa obsahu Hero sekce v administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { deleteBlob } from '../lib/blobs.js';
import { recordAuditLog } from '../lib/db-supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

  // ─── GET: Načtení hero obsahu ─────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('hero_content')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, hero: data }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání hero obsahu.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── PUT: Aktualizace hero obsahu ─────────────────────────────
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      const payload = {
        id: 1,
        headline: body.headline || 'Biorezonanční péče nové generace',
        subheadline: body.subheadline || 'Kombinace švýcarské preciznosti Bicom Optima a celostního přístupu v Písku.',
        badge_text: body.badge_text || 'Certifikovaná praxe Bicom Optima®',
        cta_primary: body.cta_primary || 'Rezervovat termín',
        cta_secondary: body.cta_secondary || 'Průvodce výběrem',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('hero_content').upsert(payload);
      if (error) throw error;

      await deleteBlob('hero:default', 'bicom-cache');
      await recordAuditLog(supabase, 'hero_content', '1', 'update', `operator:${operator.id}`, 'Hero obsah aktualizován');

      return new Response(
        JSON.stringify({ ok: true, message: 'Hero obsah byl úspěšně uložen.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při ukládání hero obsahu.', details: err.message }),
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
  path: '/admin/hero',
};
