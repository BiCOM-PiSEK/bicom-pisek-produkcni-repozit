/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Middleware (Password & Session Cookie)
 * ═══════════════════════════════════════════════════════════════
 * Ověřuje relaci administrátora pomocí podepsané cookie.
 * Poskytuje `ctx.data.operator` pro všechny admin handlery.
 * ═══════════════════════════════════════════════════════════════
 */

function getCorsHeaders(origin) {
  let allowedOrigin = 'https://bicom-pisek.cz';
  if (origin) {
    const isAllowed = origin === 'https://bicom-pisek.cz' ||
                      origin === 'https://www.bicom-pisek.cz' ||
                      origin.endsWith('.pages.dev') ||
                      /^http:\/\/localhost(:\d+)?$/.test(origin) ||
                      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);
    if (isAllowed) {
      allowedOrigin = origin;
    }
  }
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// ─── SESSION SIGNING ────────────────────────────────────────────

async function createSessionToken(secret) {
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  const signatureHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}.${signatureHex}`;
}

async function verifySessionToken(token, secret) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, signatureHex] = parts;
  
  const expires = parseInt(payload, 10);
  if (isNaN(expires) || expires < Date.now()) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  if (!/^[0-9a-fA-F]+$/.test(signatureHex)) return false;
  const signatureBytes = new Uint8Array(
    signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );
  
  return crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    encoder.encode(payload)
  );
}

// ─── MIDDLEWARE EXPORT ──────────────────────────────────────────

export async function onRequest(context) {
  const { request, env, next, data } = context;

  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(request.url);

  // 1. POST /admin/login endpoint
  if (url.pathname === '/admin/login' && request.method === 'POST') {
    try {
      const body = await request.json();
      const expectedPassword = env.SECRET_ADMIN_PASSWORD || 'Bicom-@26';
      
      if (body.password === expectedPassword) {
        const sessionToken = await createSessionToken(env.SECRET_SESSION_KEY || 'default-session-salt');
        const headers = new Headers({
          'Content-Type': 'application/json',
          'Set-Cookie': `admin_session=${sessionToken}; Path=/admin; HttpOnly; SameSite=Strict; Secure`,
          ...corsHeaders
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      } else {
        return new Response(JSON.stringify({ ok: false, error: 'Nesprávné heslo.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: 'Neplatný požadavek.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }

  // 2. GET /admin/logout endpoint
  if (url.pathname === '/admin/logout') {
    const headers = new Headers({
      'Set-Cookie': 'admin_session=; Path=/admin; HttpOnly; SameSite=Strict; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'Location': '/admin/login.html',
      ...corsHeaders
    });
    return new Response(null, { status: 302, headers });
  }

  // 3. Skip auth for static assets and login page
  if (
    url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/) ||
    url.pathname === '/admin/login.html'
  ) {
    return next();
  }

  // 4. Verify cookie-based session
  const cookieHeader = request.headers.get('Cookie');
  const sessionToken = getCookieValue(cookieHeader, 'admin_session');
  const isSessionValid = await verifySessionToken(sessionToken, env.SECRET_SESSION_KEY || 'default-session-salt');

  if (!isSessionValid) {
    const acceptHeader = request.headers.get('Accept') || '';
    const wantsHtml = acceptHeader.includes('text/html');
    const isMainRoute = url.pathname === '/admin' || url.pathname === '/admin/';
    
    // Redirect browser page requests to login page
    if (request.method === 'GET' && (wantsHtml || isMainRoute)) {
      const returnUrl = `${url.pathname}${url.search}${url.hash}`;
      const loginUrl = new URL('/admin/login.html', request.url);
      loginUrl.searchParams.set('redirect_url', returnUrl);
      
      const newHeaders = new Headers(corsHeaders);
      newHeaders.set('Location', loginUrl.toString());
      return new Response(null, { status: 302, headers: newHeaders });
    }

    return jsonError('Neoprávněný přístup — relace vypršela nebo je neplatná.', 401, corsHeaders);
  }

  // 5. Populate operator context
  let operator = null;
  if (env.DB) {
    try {
      operator = await findOperator(env.DB, 'admin@bicom-pisek.cz');
    } catch (err) {
      console.error('[admin-auth] Operator DB lookup failed:', err);
    }
  }

  if (!operator) {
    operator = {
      id: 'op_admin_box',
      email: 'admin@bicom-pisek.cz',
      name: 'Admin',
      role: 'admin',
    };
  }

  data.operator = operator;

  // SPA fallback rewrite
  const fallbackRes = await handleSpaFallback(request, env, url, corsHeaders);
  if (fallbackRes) return fallbackRes;

  const response = await next();

  // Add CORS headers to final response
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}

// ─── DB LOOKUP ─────────────────────────────────────────────────

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

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match ? match[1] : null;
}

function jsonError(message, status, corsHeaders = {}) {
  return new Response(
    JSON.stringify({ ok: false, error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}

// ─── SPA FALLBACK ───────────────────────────────────────────────

async function handleSpaFallback(request, env, url, corsHeaders) {
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
  const isPreview = url.pathname.startsWith('/admin/preview');
  const isStaticAsset = url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/);

  if (isGet && wantsHtml && !isApiHandler && !isPreview && !isStaticAsset) {
    console.info(`[admin-auth] SPA fallback rewrite to /admin/index.html for: ${url.pathname}`);
    const fallbackUrl = new URL('/admin/index.html', request.url);
    const fallbackRequest = new Request(fallbackUrl.toString(), request);
    const response = await env.ASSETS.fetch(fallbackRequest);
    
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
    
    return new Response(response.body, {
      status: 200,
      headers: newHeaders
    });
  }
  
  return null;
}
