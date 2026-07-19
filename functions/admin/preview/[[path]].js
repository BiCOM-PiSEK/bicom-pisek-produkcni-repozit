/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Náhled veřejné stránky s koncepty (F12)
 * ═══════════════════════════════════════════════════════════════
 * GET /admin/preview/            → náhled homepage (index.html)
 * GET /admin/preview/<soubor.html>
 *
 * Vrací statickou veřejnou stránku (z ASSETS) s injektovaným příznakem
 * `window.__CMS_PREVIEW__`. Klient `cms-client.js` v tomto režimu čte
 * obsah z chráněných /admin/* endpointů s `?preview=1` (draft-merge),
 * takže provozovatelka vidí, jak budou KONCEPTY vypadat — aniž by se
 * cokoli zveřejnilo. Běží pod /admin/* → chráněno CF Access (middleware).
 * ═══════════════════════════════════════════════════════════════
 */

// Injektujeme preview příznak + přepsání URL na / aby SPA router webu
// nezpůsobil 404 (vidí /admin/preview/ místo /).
const PREVIEW_FLAG = '<script>window.__CMS_PREVIEW__=true;try{history.replaceState(null,"","/")}catch(_){}<\/script>';

export async function onRequestGet({ env, params, request }) {
  // Vybrat cílovou statickou stránku (jen whitelist názvů .html v rootu).
  const segs = Array.isArray(params.path) ? params.path : (params.path ? [params.path] : []);
  let file = (segs[0] || 'index.html').toLowerCase();
  if (file === '' || file === 'home' || file === 'index') file = 'index.html';
  if (!/^[a-z0-9-]+\.html$/.test(file)) {
    return new Response('Neplatná stránka náhledu.', { status: 400 });
  }

  if (!env.ASSETS) {
    return new Response('Náhled není dostupný v tomto prostředí.', { status: 503 });
  }

  // Načíst statickou stránku přes ASSETS binding.
  const assetUrl = new URL('/' + file, request.url);
  const assetRes = await env.ASSETS.fetch(new Request(assetUrl.toString(), { headers: { Accept: 'text/html' } }));
  if (!assetRes.ok) {
    return new Response('Stránka náhledu nenalezena.', { status: 404 });
  }

  let html = await assetRes.text();

  // Injektovat příznak náhledu co nejdříve (před načtením cms-client.js).
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${PREVIEW_FLAG}\n</head>`);
  } else {
    html = PREVIEW_FLAG + html;
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Povolit vložení do iframe ve stejném originu (admin konzole).
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
