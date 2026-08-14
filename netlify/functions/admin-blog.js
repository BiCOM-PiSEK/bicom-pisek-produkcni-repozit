// netlify/functions/admin-blog.js
// Správa blogových článků a odborných publikací v administraci.

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

  // ─── GET: Výpis článků ─────────────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { data: posts, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ ok: true, posts: posts || [] }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání článků.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── POST / PUT: Vytvoření nebo úprava článku ───────────────────
  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.json();
      const { slug, title, perex, content_markdown, status, tags } = body;

      if (!slug || !title) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Slug a titulek jsou povinné.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      const payload = {
        slug,
        title,
        perex: perex || '',
        content_markdown: content_markdown || '',
        status: status || 'draft',
        tags: Array.isArray(tags) ? tags : [],
        updated_at: new Date().toISOString(),
        author_id: operator.id,
      };

      if (status === 'published') {
        payload.published_at = new Date().toISOString();
      }

      const { error } = await supabase.from('blog_posts').upsert(payload);
      if (error) throw error;

      await recordAuditLog(supabase, 'blog_posts', slug, request.method === 'POST' ? 'create' : 'update', `operator:${operator.id}`, `Článek ${title} uložen (${status})`);

      return new Response(
        JSON.stringify({ ok: true, message: 'Článek byl úspěšně uložen.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při ukládání článku.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── DELETE: Smazání článku ────────────────────────────────────
  if (request.method === 'DELETE') {
    try {
      const body = await request.json();
      const { slug } = body;
      if (!slug) {
        return new Response(JSON.stringify({ ok: false, error: 'Chybí slug článku.' }), { status: 400, headers: CORS_HEADERS });
      }

      await supabase.from('blog_posts').delete().eq('slug', slug);
      await recordAuditLog(supabase, 'blog_posts', slug, 'delete', `operator:${operator.id}`, `Článek ${slug} smazán`);

      return new Response(
        JSON.stringify({ ok: true, message: 'Článek byl úspěšně smazán.' }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při mazání článku.', details: err.message }),
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
  path: '/admin/blog',
};
