/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné CMS API: Hero banner
 * ═══════════════════════════════════════════════════════════════
 * GET /api/hero?key=PAGE → { ok, data: {...} | null }
 * KV cache 5 min (vč. negativní cache). Výpadek cache je best-effort.
 * ═══════════════════════════════════════════════════════════════
 */

const CORS = { 'Access-Control-Allow-Origin': '*' };

/**
 * Sestaví JSON Response s CORS a volitelnými extra hlavičkami.
 * @param {*} data
 * @param {number} [status=200]
 * @param {Object} [extra={}]
 * @returns {Response}
 */
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });

/**
 * Handler GET /api/hero — vrátí hero konfiguraci stránky (nebo null).
 * @param {{ env: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ ok: false, error: 'Chybí parametr key.' }, 400);

  const cacheK = `cms:hero:${key}`;

  // Text-get rozliší uloženou hodnotu "null" (negativní cache) od chybějícího klíče.
  if (env.CACHE) {
    try {
      const cachedRaw = await env.CACHE.get(cacheK);
      if (cachedRaw !== null) {
        return json({ ok: true, data: JSON.parse(cachedRaw) }, 200, { 'X-Cache': 'HIT' });
      }
    } catch (e) {
      console.warn('[api/hero] cache get failed:', e?.message);
    }
  }

  try {
    const row = await env.DB.prepare(
      `SELECT page_key, headline, subheadline, cta_text, cta_link, background_image_url, overlay_color
       FROM hero_config WHERE page_key = ?`
    ).bind(key).first();

    const data = row || null;
    if (env.CACHE) {
      env.CACHE.put(cacheK, JSON.stringify(data), { expirationTtl: 300 })
        .catch((e) => console.warn('[api/hero] cache put failed:', e?.message));
    }
    return json({ ok: true, data }, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error('[api/hero] error:', err);
    return json({ ok: false, error: 'Hero dočasně nedostupný.' }, 503);
  }
}
