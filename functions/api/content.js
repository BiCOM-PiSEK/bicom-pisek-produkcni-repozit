/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné CMS API: Textové sekce
 * ═══════════════════════════════════════════════════════════════
 * GET /api/content?key=KEY  → { ok, data: { section_key, title, content } | null }
 * Bez autentizace. KV cache (binding CACHE) 60 s, vč. negativní cache.
 * Výpadek cache je best-effort (neshodí čtení z DB). Při výpadku DB
 * vrací 503 a klient si ponechá hardcoded fallback.
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
 * Handler GET /api/content — vrátí textovou sekci z content_blocks.
 * @param {{ env: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ ok: false, error: 'Chybí parametr key.' }, 400);

  const cacheK = `cms:section:${key}`;

  // Cache je best-effort: případná chyba KV nesmí shodit odpověď z DB.
  // Čteme jako text, ať rozlišíme uloženou hodnotu "null" (negativní cache)
  // od chybějícího klíče.
  if (env.CACHE) {
    try {
      const cachedRaw = await env.CACHE.get(cacheK);
      if (cachedRaw !== null) {
        return json({ ok: true, data: JSON.parse(cachedRaw) }, 200, { 'X-Cache': 'HIT' });
      }
    } catch (e) {
      console.warn('[api/content] cache get failed:', e?.message);
    }
  }

  try {
    const row = await env.DB.prepare(
      'SELECT section_key, title, content_markdown AS content, content_type FROM content_blocks WHERE section_key = ?'
    ).bind(key).first();

    const data = row || null; // neexistující sekce → data:null (klient ponechá fallback)
    if (env.CACHE) {
      // Pozitivní i negativní cache; null jen krátce (60 s), ať se nově
      // vytvořená sekce projeví brzy.
      env.CACHE.put(cacheK, JSON.stringify(data), { expirationTtl: 60 })
        .catch((e) => console.warn('[api/content] cache put failed:', e?.message));
    }
    return json({ ok: true, data }, 200, { 'X-Cache': 'MISS' });
  } catch (err) {
    console.error('[api/content] error:', err);
    return json({ ok: false, error: 'Obsah dočasně nedostupný.' }, 503);
  }
}
