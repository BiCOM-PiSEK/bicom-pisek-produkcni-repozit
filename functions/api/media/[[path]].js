/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Veřejné servírování médií z R2 (binding MEDIA)
 * ═══════════════════════════════════════════════════════════════
 * GET /api/media/<r2-key>  → streamuje objekt z R2 s cache hlavičkami.
 *
 * Tímto se klientky vyhnou nutnosti konfigurovat veřejnou R2 doménu
 * či CDN — obrázky nahrané v CMS jsou hned dostupné na vlastní doméně.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Handler GET /api/media/* — streamuje objekt z R2 bindingu MEDIA.
 * @param {{ env: Object, params: { path: string|string[] }, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestGet({ env, params, request }) {
  if (!env.MEDIA) {
    return new Response('Media storage unavailable', { status: 503 });
  }

  // Catch-all [[path]] → pole segmentů; složit zpět na R2 klíč.
  // Pro /api/media (bez cesty) je params.path undefined → 400.
  if (params.path == null) {
    return new Response('Bad request', { status: 400 });
  }
  const segments = Array.isArray(params.path) ? params.path : [params.path];

  let key;
  try {
    key = segments.map((s) => decodeURIComponent(s)).join('/');
  } catch {
    // neplatný percent-encoding
    return new Response('Bad request', { status: 400 });
  }

  if (!key || key.includes('..')) {
    return new Response('Bad request', { status: 400 });
  }

  // Podmíněný požadavek (ETag) — ušetří přenos. Chyba R2 → 503 (ne uncaught 500).
  let object;
  try {
    object = await env.MEDIA.get(key, {
      onlyIf: request.headers.get('If-None-Match')
        ? { etagDoesNotMatch: request.headers.get('If-None-Match') }
        : undefined,
    });
  } catch (err) {
    console.error('[api/media] R2 get failed:', err?.message);
    return new Response('Media storage unavailable', { status: 503 });
  }

  if (object === null) {
    return new Response('Not found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  headers.set('Access-Control-Allow-Origin', '*');

  // 304 Not Modified — objekt nemá body
  if (!object.body) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}
