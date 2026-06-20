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

export async function onRequestGet({ env, params, request }) {
  if (!env.MEDIA) {
    return new Response('Media storage unavailable', { status: 503 });
  }

  // Catch-all [[path]] → pole segmentů; složit zpět na R2 klíč
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const key = segments.map((s) => decodeURIComponent(s)).join('/');

  if (!key || key.includes('..')) {
    return new Response('Bad request', { status: 400 });
  }

  // Podmíněný požadavek (ETag) — ušetří přenos
  const object = await env.MEDIA.get(key, {
    onlyIf: request.headers.get('If-None-Match')
      ? { etagDoesNotMatch: request.headers.get('If-None-Match') }
      : undefined,
  });

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
