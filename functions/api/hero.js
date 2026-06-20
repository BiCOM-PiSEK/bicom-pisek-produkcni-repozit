/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné CMS API: Hero banner
 * ═══════════════════════════════════════════════════════════════
 * GET /api/hero?key=PAGE → { ok, data: {...} | null }
 * KV cache 5 min.
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

  const cacheK = `cms:hero:${key}`;

  try {
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheK, 'json');
      if (cached) return json({ ok: true, data: cached }, 200, { 'X-Cache': 'HIT' });
    }

    const row = await env.DB.prepare(
      `SELECT page_key, headline, subheadline, cta_text, cta_link, background_image_url, overlay_color
       FROM hero_config WHERE page_key = ?`
    ).bind(key).first();

    if (!row) return json({ ok: true, data: null }, 200, { 'X-Cache': 'MISS' });

    if (env.CACHE) {
      await env.CACHE.put(cacheK, JSON.stringify(row), { expirationTtl: 300 });
    }
    return json({ ok: true, data: row }, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error('[api/hero] error:', err);
    return json({ ok: false, error: 'Hero dočasně nedostupný.' }, 503);
  }
}
