/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné CMS API: Galerie
 * ═══════════════════════════════════════════════════════════════
 * GET /api/gallery?key=KEY → { ok, data: { items: [...] } }
 * Vrací jen aktivní obrázky seřazené dle sort_order. KV cache 5 min.
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

  const cacheK = `cms:gallery:${key}`;

  try {
    if (env.CACHE) {
      const cached = await env.CACHE.get(cacheK, 'json');
      if (cached) return json({ ok: true, data: { items: cached } }, 200, { 'X-Cache': 'HIT' });
    }

    const { results } = await env.DB.prepare(
      `SELECT title, caption, image_url, sort_order
       FROM gallery_items
       WHERE gallery_key = ? AND active = 1
       ORDER BY sort_order, created_at`
    ).bind(key).all();

    const items = results || [];
    if (env.CACHE) {
      await env.CACHE.put(cacheK, JSON.stringify(items), { expirationTtl: 300 });
    }
    return json({ ok: true, data: { items } }, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error('[api/gallery] error:', err);
    return json({ ok: false, error: 'Galerie dočasně nedostupná.' }, 503);
  }
}
