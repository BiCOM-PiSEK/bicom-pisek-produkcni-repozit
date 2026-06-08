/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Middleware (Cloudflare Access JWT)
 * ═══════════════════════════════════════════════════════════════
 * Ověřuje JWT token z Cloudflare Access na cestách /admin/*.
 * Identifikuje operátorku z JWT e-mailu → operators tabulka.
 * Poskytuje `ctx.data.operator` pro všechny admin handlery.
 *
 * V dev režimu (SECRET_CF_ACCESS_TEAM = undefined) povolí
 * přístup bez ověření s demo operátorkou.
 * ═══════════════════════════════════════════════════════════════
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Middleware pro admin endpointy.
 * Cloudflare Pages Functions middleware — export onRequest.
 */
export async function onRequest(context) {
  const { request, env, next, data } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Skip auth for static assets (CSS, JS, images)
  const url = new URL(request.url);
  if (
    url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/) ||
    url.pathname === '/admin' ||
    url.pathname === '/admin/' ||
    url.pathname === '/admin/index.html'
  ) {
    return next();
  }

  // Dev mode — pokud CF Access team není nastaven, povolí přístup pouze v lokálním vývoji.
  // Mimo dev (produkce / *.pages.dev) tvrdě zamítneme fallback a vrátíme 403.
  const cfTeam = env.SECRET_CF_ACCESS_TEAM;
  if (!cfTeam) {
    const isProd = env.ENV === 'production' || (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1'));
    if (isProd) {
      console.error('[admin-auth] Access blocked: production/deployed environment detected but SECRET_CF_ACCESS_TEAM is not configured.');
      return jsonError('Přístup zamítnut — chybí konfigurace autorizační služby.', 403);
    }

    data.operator = {
      id: 'dev-operator',
      email: 'dev@bicompisek.cz',
      name: 'Dev Režim',
      role: 'admin',
      isDev: true,
    };
    console.info('[admin-auth] Dev mode — no CF Access team configured');
    const fallbackRes = await handleSpaFallback(request, env, url);
    if (fallbackRes) return fallbackRes;
    return next();
  }

  // Production mode — ověření JWT z Cloudflare Access
  const jwtToken =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    getCookieValue(request.headers.get('Cookie'), 'CF_Authorization');

  if (!jwtToken) {
    return jsonError('Neoprávněný přístup — chybí autorizační token.', 401);
  }

  try {
    // Ověření JWT
    const payload = await verifyJWT(jwtToken, cfTeam, env.SECRET_CF_ACCESS_AUD);

    if (!payload || !payload.email) {
      return jsonError('Neplatný token — nelze identifikovat uživatele.', 403);
    }

    // Vyhledat operátorku v DB
    const normalizedEmail = String(payload.email).trim().toLowerCase();
    const operator = await findOperator(env.DB, normalizedEmail);

    if (!operator) {
      console.warn(`[admin-auth] Unknown operator: ${normalizedEmail}`);
      return jsonError('Přístup zamítnut — váš e-mail není registrován.', 403);
    }

    // Nastavit kontext pro handlery
    data.operator = operator;
    data.jwtPayload = payload;

  } catch (err) {
    console.error('[admin-auth] JWT verification failed:', err);
    return jsonError('Chyba ověření — zkuste se přihlásit znovu.', 401);
  }

  // SPA fallback rewrite po úspěšném ověření tokenu
  const fallbackRes = await handleSpaFallback(request, env, url);
  if (fallbackRes) return fallbackRes;

  // Pokračuj ke handleru
  const response = await next();

  // Přidej CORS headers
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

// ─── JWT VERIFICATION ────────────────────────────────────────────

/**
 * Ověří Cloudflare Access JWT.
 * @param {string} token   — JWT token
 * @param {string} team    — CF Access team domain (e.g., 'bicompisek')
 * @param {string} aud     — CF Access Application Audience (AUD) tag
 * @returns {Promise<Object|null>} — JWT payload nebo null
 */
async function verifyJWT(token, team, aud) {
  // Rozděl JWT
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  // TODO: Doplňte plnohodnotné ověření PODPISU Cloudflare Access JWT proti JWKS certifikátům.
  // Dnes se pro zjednodušení ověřují pouze claims (iss, aud, exp), což spoléhá na to,
  // že Cloudflare Access aktivně vynucuje ochranu na edge (před vstupem do Workeru).
  // Implementační kroky pro budoucí PR:
  // 1. Načíst JWKS certifikáty z: https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
  // 2. Parsnout token header, získat 'kid' a vyhledat odpovídající veřejný klíč v JWKS.
  // 3. Použít Web Crypto API (crypto.subtle.importKey a crypto.subtle.verify) pro ověření podpisu tokenu.
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

  // Kontrola issuer
  const expectedIss = `https://${team}.cloudflareaccess.com`;
  if (payload.iss !== expectedIss) {
    console.warn(`[admin-auth] Invalid issuer: ${payload.iss} vs ${expectedIss}`);
    return null;
  }

  // Kontrola audience (podpora pro více AUD hodnot oddělených čárkou)
  if (aud && payload.aud) {
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const allowedAuds = aud.split(',').map(a => a.trim());
    const hasValidAud = audArray.some(tokenAud => allowedAuds.includes(tokenAud));
    if (!hasValidAud) {
      console.warn('[admin-auth] Invalid audience');
      return null;
    }
  }

  // Kontrola expirace
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    console.warn('[admin-auth] Token expired');
    return null;
  }

  // Kontrola "not before"
  if (payload.nbf && payload.nbf > now + 60) {
    console.warn('[admin-auth] Token not yet valid');
    return null;
  }

  return payload;
}

// ─── DB LOOKUP ─────────────────────────────────────────────────

/**
 * Vyhledá operátorku v tabulce operators dle e-mailu.
 * @param {D1Database} db
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findOperator(db, email) {
  if (!db) return null;

  try {
    const result = await db
      .prepare('SELECT id, email, name, role FROM operators WHERE email = ? COLLATE NOCASE AND active = 1')
      .bind(email)
      .first();

    return result || null;
  } catch (err) {
    console.error('[admin-auth] DB lookup failed:', err);
    return null;
  }
}

// ─── HELPERS ────────────────────────────────────────────────────

/**
 * Extrahuje hodnotu cookie.
 * @param {string|null} cookieHeader
 * @param {string} name
 * @returns {string|null}
 */
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match ? match[1] : null;
}

/**
 * JSON error response.
 * @param {string} message
 * @param {number} status
 * @returns {Response}
 */
function jsonError(message, status) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS,
      },
    }
  );
}

// ─── SPA FALLBACK ───────────────────────────────────────────────

/**
 * Provede SPA fallback na /admin/index.html pro klientské routy.
 * @param {Request} request
 * @param {Object} env
 * @param {URL} url
 * @returns {Promise<Response|null>}
 */
async function handleSpaFallback(request, env, url) {
  const acceptHeader = request.headers.get('Accept') || '';
  const apiHandlers = [
    '/admin/activity',
    '/admin/bookings',
    '/admin/copywriter',
    '/admin/dashboard',
    '/admin/geo',
    '/admin/invoices',
    '/admin/payments',
    '/admin/settings'
  ];

  const isGet = request.method === 'GET';
  const wantsHtml = acceptHeader.includes('text/html');
  const isApiHandler = apiHandlers.some(path => 
    url.pathname === path || url.pathname === `${path}/`
  );
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/);

  if (isGet && wantsHtml && !isApiHandler && !isStaticAsset) {
    console.info(`[admin-auth] SPA fallback rewrite to /admin/index.html for: ${url.pathname}`);
    const fallbackUrl = new URL('/admin/index.html', request.url);
    const fallbackRequest = new Request(fallbackUrl.toString(), request);
    const response = await env.ASSETS.fetch(fallbackRequest);
    
    const newHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
    
    return new Response(response.body, {
      status: 200,
      headers: newHeaders
    });
  }
  
  return null;
}
