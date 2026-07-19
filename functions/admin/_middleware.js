/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Middleware (Cloudflare Access JWT)
 * ═══════════════════════════════════════════════════════════════
 * Ověřuje přístup na cestách /admin/*.
 * Primárně přes interní admin heslo (X-Admin-Password / cookie admin_auth).
 * Volitelně podporuje i historický Cloudflare Access JWT režim.
 * Identifikuje operátorku z DB (`operators`) a poskytuje `ctx.data.operator`.
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

const ADMIN_PASSWORD_DASH_VARIANTS_REGEX = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const ADMIN_PASSWORD_PLUS_VARIANTS_REGEX = /[\uFF0B\uFE62\u207A\u208A\u2795]/g;
const ADMIN_PASSWORD_AT_VARIANTS_REGEX = /[\uFF20\uFE6B]/g;
const ADMIN_PASSWORD_ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const ADMIN_PASSWORD_CZ_NUMBER_ROW_REGEX = /[ěščřžýáíéĚŠČŘŽÝÁÍÉ]/g;
const ADMIN_PASSWORD_CZ_NUMBER_ROW_MAP = {
  'ě': '2', 'š': '3', 'č': '4', 'ř': '5', 'ž': '6', 'ý': '7', 'á': '8', 'í': '9', 'é': '0',
  'Ě': '2', 'Š': '3', 'Č': '4', 'Ř': '5', 'Ž': '6', 'Ý': '7', 'Á': '8', 'Í': '9', 'É': '0',
};
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map();

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

  // Skip auth for static assets a pro samotný admin shell.
  const url = new URL(request.url);
  if (
    url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/) ||
    url.pathname === '/admin' ||
    url.pathname === '/admin/' ||
    url.pathname === '/admin/index.html'
  ) {
    return next();
  }

  // Deep-link routy admin SPA (např. /admin/nastaveni) musí vrátit shell
  // ještě před auth gate, jinak browser skončí na JSON 401/404 místo SPA.
  const shellFallback = await handleSpaFallback(request, env, url);
  if (shellFallback) {
    return shellFallback;
  }

  const cookieHeader = request.headers.get('Cookie');
  const adminPassword = normalizeAdminPassword(
    request.headers.get('X-Admin-Password') ||
    getCookieValue(cookieHeader, 'admin_auth') ||
    ''
  );
  const expectedAdminPassword = normalizeAdminPassword(env.SECRET_ADMIN_PASSWORD || env.SECRET_MAINTENANCE_PIN || '');

  // Preferovaný režim: interní admin heslo.
  if (expectedAdminPassword) {
    if (!adminPassword || adminPassword !== expectedAdminPassword) {
      return jsonError('Neoprávněný přístup — chybné nebo chybějící heslo.', 401);
    }
    const operator = await findDefaultOperator(env.DB);
    if (!operator) {
      return jsonError('Přístup zamítnut — nebyl nalezen aktivní operátor.', 403);
    }
    data.operator = operator;
    const fallbackRes = await handleSpaFallback(request, env, url);
    if (fallbackRes) return fallbackRes;
    const response = await next();
    return withCors(response);
  }

  // Legacy režim — pokud heslo není nastavené, zkusíme Cloudflare Access.
  // Pokud ani ten není nastaven, povolíme fallback jen v lokálním vývoji.
  const cfTeam = env.SECRET_CF_ACCESS_TEAM;
  if (!cfTeam) {
    const isProd = env.ENV === 'production' || (!url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1'));
    if (isProd) {
      return jsonError('Přístup zamítnut — chybí konfigurace admin hesla.', 403);
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
    getCookieValue(cookieHeader, 'CF_Authorization');

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

  return withCors(response);
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
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart(encodedHeader);
  const payload = parseJwtPart(encodedPayload);
  if (!header || !payload) return null;

  if (header.alg !== 'RS256' || !header.kid) {
    console.warn(`[admin-auth] Unsupported JWT header: alg=${header.alg}, kid=${header.kid || 'missing'}`);
    return null;
  }

  const jwk = await getCfAccessJwk(team, header.kid);
  if (!jwk) {
    console.warn('[admin-auth] Matching JWKS key not found.');
    return null;
  }

  const signatureValid = await verifyRs256Signature(encodedHeader, encodedPayload, encodedSignature, jwk);
  if (!signatureValid) {
    console.warn('[admin-auth] Invalid JWT signature');
    return null;
  }

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

async function getCfAccessJwk(team, kid) {
  const cached = jwksCache.get(team);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.keysByKid.get(kid) || null;
  }

  const certsUrl = `https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const response = await fetch(certsUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to fetch CF Access certs: ${response.status}`);
  }

  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  const keysByKid = new Map();
  keys.forEach((key) => {
    if (key?.kid) {
      keysByKid.set(key.kid, key);
    }
  });

  jwksCache.set(team, {
    expiresAt: now + JWKS_CACHE_TTL_MS,
    keysByKid,
  });

  return keysByKid.get(kid) || null;
}

async function verifyRs256Signature(encodedHeader, encodedPayload, encodedSignature, jwk) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const signature = decodeBase64Url(encodedSignature);
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signature,
    encoder.encode(signingInput)
  );
}

function parseJwtPart(encodedPart) {
  try {
    const json = new TextDecoder().decode(decodeBase64Url(encodedPart));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

/**
 * Najde výchozí aktivní operátorku (owner > admin) pro heslový login.
 * @param {D1Database} db
 * @returns {Promise<Object|null>}
 */
async function findDefaultOperator(db) {
  if (!db) return null;
  try {
    const row = await db
      .prepare(`SELECT id, email, name, role
                FROM operators
                WHERE active = 1
                ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
                LIMIT 1`)
      .first();
    return row || null;
  } catch (err) {
    console.error('[admin-auth] DB default operator lookup failed:', err);
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
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Normalizuje heslo z headeru/cookie/env tak, aby ručně psané varianty
 * (typografická pomlčka / full-width znaky) odpovídaly při porovnání.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeAdminPassword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(ADMIN_PASSWORD_ZERO_WIDTH_REGEX, '')
    .replace(ADMIN_PASSWORD_DASH_VARIANTS_REGEX, '-')
    .replace(ADMIN_PASSWORD_PLUS_VARIANTS_REGEX, '+')
    .replace(ADMIN_PASSWORD_AT_VARIANTS_REGEX, '@')
    .replace(ADMIN_PASSWORD_CZ_NUMBER_ROW_REGEX, (ch) => ADMIN_PASSWORD_CZ_NUMBER_ROW_MAP[ch] || ch)
    .replace(/\s*([+-])\s*/g, '$1')
    .trim();
}

/**
 * JSON error response.
 * @param {string} message
 * @param {number} status
 * @returns {Response}
 */
function jsonError(message, status) {
  const headers = {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
  };
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    {
      status,
      headers,
    }
  );
}

/** @param {Response} response */
function withCors(response) {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
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
    '/admin/content',
    '/admin/copywriter',
    '/admin/dashboard',
    '/admin/drafts',
    '/admin/gallery',
    '/admin/geo',
    '/admin/hero',
    '/admin/invoices',
    '/admin/payments',
    '/admin/services',
    '/admin/settings'
  ];

  const isGet = request.method === 'GET';
  const wantsHtml = acceptHeader.includes('text/html');
  const isApiHandler = apiHandlers.some(path =>
    url.pathname === path || url.pathname === `${path}/`
  );
  // Náhled veřejné stránky (F12) má vlastní handler — nepřepisovat na SPA.
  const isPreview = url.pathname.startsWith('/admin/preview');
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/);

  if (isGet && wantsHtml && !isApiHandler && !isPreview && !isStaticAsset) {
    console.info(`[admin-auth] SPA fallback rewrite to admin shell for: ${url.pathname}`);
    const response = await fetchAdminShell(request, env);
    if (!response) {
      return jsonError('Admin shell se nepodařilo načíst.', 500);
    }
    return withCors(response);
  }
  
  return null;
}

/**
 * Načte admin shell přes asset binding a dorovná případný interní redirect.
 * Cloudflare Pages někdy vrátí pro /admin/index.html redirect na /admin/,
 * což by po prostém přeposlání skončilo prázdnou stránkou.
 * @param {Request} request
 * @param {Object} env
 * @returns {Promise<Response|null>}
 */
async function fetchAdminShell(request, env) {
  const shellCandidates = ['/admin/', '/admin/index.html'];

  for (const shellPath of shellCandidates) {
    let response = await env.ASSETS.fetch(buildShellRequest(request, shellPath));

    if (isRedirectResponse(response)) {
      const redirectLocation = response.headers.get('Location');
      if (redirectLocation) {
        const redirectedUrl = new URL(redirectLocation, request.url);
        response = await env.ASSETS.fetch(buildShellRequest(request, redirectedUrl.pathname));
      }
    }

    if (response.ok && !isEmptyHtmlResponse(response)) {
      const headers = new Headers(response.headers);
      headers.delete('Location');
      return new Response(response.body, {
        status: 200,
        headers,
      });
    }
  }

  return null;
}

/**
 * @param {Request} request
 * @param {string} shellPath
 */
function buildShellRequest(request, shellPath) {
  const shellUrl = new URL(shellPath, request.url);
  const headers = new Headers(request.headers);
  headers.set('Accept', 'text/html');
  return new Request(shellUrl.toString(), {
    method: 'GET',
    headers,
  });
}

/** @param {Response} response */
function isRedirectResponse(response) {
  return response.status >= 300 && response.status < 400;
}

/** @param {Response} response */
function isEmptyHtmlResponse(response) {
  return response.headers.get('Content-Length') === '0';
}
