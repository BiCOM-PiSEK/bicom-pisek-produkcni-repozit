/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné CMS API: Textové sekce
 * ═══════════════════════════════════════════════════════════════
 * GET /api/content?key=KEY  → { ok, data: { section_key, title, content } }
 * Bez autentizace. KV cache (binding CACHE) 60 s. Při výpadku DB
 * vrací 503 a klient si ponechá hardcoded fallback.
 * ═══════════════════════════════════════════════════════════════
 */

const CORS = { 'Access-Control-Allow-Origin': '*' };
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ ok: false, error: 'Chybí parametr key.' }, 400);

  const cacheK = `cms:section:${key}`;

  try {
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheK, 'json');
      if (cached) return json({ ok: true, data: cached }, 200, { 'X-Cache': 'HIT' });
    }

    const row = await env.DB.prepare(
      'SELECT section_key, title, content_markdown AS content, content_type FROM content_blocks WHERE section_key = ?'
    ).bind(key).first();

    // Neexistující sekce: 200 + data:null → klient tiše ponechá hardcoded fallback
    if (!row) return json({ ok: true, data: null }, 200, { 'X-Cache': 'MISS' });

    if (env.CACHE) {
      await env.CACHE.put(cacheK, JSON.stringify(row), { expirationTtl: 60 });
    }
    return json({ ok: true, data: row }, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error('[api/content] error:', err);
    return json({ ok: false, error: 'Obsah dočasně nedostupný.' }, 503);
  }
}
