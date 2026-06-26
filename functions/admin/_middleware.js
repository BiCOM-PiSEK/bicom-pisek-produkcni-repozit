/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Middleware (Password & Session Cookie)
 * ═══════════════════════════════════════════════════════════════
 * Ověřuje relaci administrátora pomocí podepsané cookie.
 * Poskytuje `ctx.data.operator` pro všechny admin handlery.
 * ═══════════════════════════════════════════════════════════════
 */

// ─── INLINE LOGIN PAGE ─────────────────────────────────────────
// Served directly from the middleware to bypass Cloudflare Pages
// Pretty URLs and _redirects which caused infinite redirect loops.

const LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Přihlášení — Bicom Písek Virtual Office</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --c-alabaster: #FAF8F5;
      --c-sage: #738A75;
      --c-forest: #3A4A3C;
      --c-forest-deep: #2E3E30;
      --c-champagne: #C5A880;
      --c-charcoal: #2B2B2B;
      --c-white: #FFFFFF;
      --c-error: #C45D4F;
      --c-error-bg: #FDF2F0;
      --font-head: "Cormorant Garamond", Georgia, serif;
      --font-body: "Montserrat", system-ui, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--c-alabaster);
      color: var(--c-charcoal);
      font-family: var(--font-body);
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 20px;
      background-image:
        radial-gradient(circle at 10% 20%, rgba(115,138,117,0.03) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(197,168,120,0.03) 0%, transparent 40%);
    }
    .login-card {
      background: var(--c-white); border-radius: 16px;
      box-shadow: 0 10px 40px rgba(58,74,60,0.06);
      width: 100%; max-width: 400px; padding: 48px 36px;
      border: 1px solid rgba(115,138,117,0.1);
      transform: translateY(10px); opacity: 0;
      animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
    }
    @keyframes slideUp { to { transform: translateY(0); opacity: 1; } }
    .login-logo { font-size: 3.5rem; text-align: center; margin-bottom: 8px;
      filter: drop-shadow(0 4px 10px rgba(58,74,60,0.05)); }
    .login-header { text-align: center; margin-bottom: 28px; }
    .login-title { font-family: var(--font-head); font-size: 2.25rem;
      color: var(--c-forest); margin: 0 0 4px 0; font-weight: 500; letter-spacing: -0.5px; }
    .login-subtitle { font-size: 0.85rem; color: var(--c-sage); margin: 0; font-weight: 500; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 0.7rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; color: var(--c-sage); margin-bottom: 8px; }
    .form-input { width: 100%; height: 42px; padding: 0 16px; border-radius: 10px;
      border: 1px solid rgba(115,138,117,0.2); font-family: var(--font-body);
      font-size: 0.95rem; background: var(--c-alabaster); color: var(--c-charcoal);
      transition: all 0.2s ease; }
    .form-input:focus { outline: none; border-color: var(--c-sage);
      background: var(--c-white); box-shadow: 0 0 0 3px rgba(115,138,117,0.15); }
    .login-btn { width: 100%; height: 42px; border-radius: 10px;
      background: var(--c-forest); color: var(--c-white); border: none;
      font-family: var(--font-body); font-weight: 600; font-size: 0.95rem;
      cursor: pointer; transition: all 0.2s ease;
      box-shadow: 0 2px 8px rgba(58,74,60,0.1);
      display: flex; align-items: center; justify-content: center; gap: 8px; }
    .login-btn:hover { background: var(--c-forest-deep); transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(58,74,60,0.15); }
    .login-btn:active { transform: translateY(0); }
    .login-btn:disabled { opacity: 0.6; cursor: wait; }
    .login-error { display: none; background: var(--c-error-bg); color: var(--c-error);
      border: 1px solid rgba(196,93,79,0.15); padding: 12px; border-radius: 10px;
      font-size: 0.85rem; margin-bottom: 20px; animation: shake 0.4s ease-in-out; font-weight: 500; }
    @keyframes shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    .login-footer { text-align: center; margin-top: 28px; font-size: 0.7rem; color: var(--c-sage); }
    .login-footer p { margin: 0; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">🔒</div>
    <div class="login-header">
      <h1 class="login-title">Bicom Písek</h1>
      <p class="login-subtitle">Vstup do virtuální kanceláře</p>
    </div>
    <div class="login-error" id="error-message"></div>
    <form id="login-form">
      <div class="form-group">
        <label class="form-label" for="password">Přístupové heslo</label>
        <input class="form-input" type="password" id="password" required autocomplete="current-password" autofocus placeholder="••••••••">
      </div>
      <button class="login-btn" type="submit" id="submit-btn">
        <span>Přihlásit se</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </button>
    </form>
    <div class="login-footer"><p>&copy; 2026 BIO ONE LIFE s.r.o.</p></div>
  </div>
  <script>
    const form = document.getElementById('login-form');
    const pw = document.getElementById('password');
    const err = document.getElementById('error-message');
    const btn = document.getElementById('submit-btn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.style.display = 'none';
      btn.disabled = true;
      btn.querySelector('span').innerText = 'Ověřování...';
      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw.value })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          const p = new URLSearchParams(window.location.search);
          window.location.href = p.get('redirect_url') || '/admin/';
        } else {
          showErr(data.error || 'Nesprávné heslo.');
        }
      } catch (_) {
        showErr('Nelze se spojit se serverem.');
      } finally {
        btn.disabled = false;
        btn.querySelector('span').innerText = 'Přihlásit se';
      }
    });
    function showErr(t) { err.innerText = t; err.style.display = 'block'; pw.value = ''; pw.focus(); }
  </script>
</body>
</html>`;


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
          'Set-Cookie': `admin_session=${sessionToken}; Path=/admin; HttpOnly; SameSite=Lax; Secure`,
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
      'Set-Cookie': 'admin_session=; Path=/admin; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'Location': '/admin/login',
      ...corsHeaders
    });
    return new Response(null, { status: 302, headers });
  }

  // 3. Skip auth for static assets
  if (url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/)) {

    return next();
  }

  // 3b. Serve login page directly (inline HTML — bypasses Pretty URLs & _redirects)
  const isLoginPage = url.pathname === '/admin/login' || url.pathname === '/admin/login.html';
  if (isLoginPage && request.method === 'GET') {
    return new Response(LOGIN_PAGE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders }
    });
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
      // Use only pathname for return URL to prevent recursive redirect_url nesting
      const returnUrl = url.pathname;
      const loginUrl = new URL('/admin/login', request.url);
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
  const isIndexHtml = url.pathname === '/admin/index.html';

  if (isGet && wantsHtml && !isApiHandler && !isPreview && !isStaticAsset && !isIndexHtml) {
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
