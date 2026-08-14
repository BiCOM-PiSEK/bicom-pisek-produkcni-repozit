/**
 * netlify/edge-functions/admin-auth.ts
 *
 * Edge Middleware pro ochranu administrativní části (/admin/*) na Netlify.
 * - Zobrazuje přihlašovací formulář nebo přesměrovává na /admin/login při neplatné relaci.
 * - Ověřuje HMAC podpis session tokenu v cookie `admin_session`.
 * - Umožňuje bezpečný přístup k Virtual Office SPA.
 *
 * Runtime: Deno (Netlify Edge Functions)
 */

import type { Config, Context } from '@netlify/edge-functions';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function base64UrlDecode(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    return atob(padded);
  } catch {
    return '';
  }
}

async function verifyEdgeSession(token: string, secretKey: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) return false;

  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey || 'default-session-salt');
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigStr = base64UrlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      signatureBytes[i] = sigStr.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      encoder.encode(encodedPayload)
    );

    if (!isValid) return false;

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson);
    return Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

const LOGIN_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Přihlášení — Bicom Písek Virtual Office</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --c-alabaster: #FAF8F5;
      --c-sage: #738A75;
      --c-forest: #3A4A3C;
      --c-forest-deep: #2A362C;
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
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: var(--c-white);
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(58, 74, 60, 0.08);
      border: 1px solid rgba(115, 138, 117, 0.15);
    }
    .login-logo { font-size: 2.2rem; text-align: center; margin-bottom: 8px; }
    .login-header { text-align: center; margin-bottom: 28px; }
    .login-title { font-family: var(--font-head); font-size: 1.8rem; font-weight: 600; color: var(--c-forest); margin-bottom: 4px; }
    .login-subtitle { font-size: 0.85rem; color: var(--c-sage); }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 0.8rem; font-weight: 600; color: var(--c-forest); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input {
      width: 100%; height: 44px; padding: 0 14px; border-radius: 10px;
      border: 1px solid rgba(115, 138, 117, 0.3); font-family: var(--font-body);
      font-size: 0.95rem; background: var(--c-alabaster); transition: all 0.2s ease;
    }
    .form-input:focus { outline: none; border-color: var(--c-sage); background: var(--c-white); box-shadow: 0 0 0 3px rgba(115,138,117,0.15); }
    .login-btn {
      width: 100%; height: 44px; border-radius: 10px; background: var(--c-forest);
      color: var(--c-white); border: none; font-family: var(--font-body); font-weight: 600;
      font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease;
    }
    .login-btn:hover { background: var(--c-forest-deep); }
    .login-error {
      display: none; background: var(--c-error-bg); color: var(--c-error);
      border: 1px solid rgba(196,93,79,0.15); padding: 10px 14px; border-radius: 8px;
      font-size: 0.85rem; margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-logo">🔒</div>
    <div class="login-header">
      <h1 class="login-title">Bicom Písek</h1>
      <p class="login-subtitle">Vstup do virtuální kanceláře</p>
    </div>
    <div class="login-error" id="error-box"></div>
    <form id="login-form">
      <div class="form-group">
        <label class="form-label" for="pwd">Heslo administrátora</label>
        <input class="form-input" type="password" id="pwd" required autofocus placeholder="••••••••">
      </div>
      <button class="login-btn" type="submit" id="submit-btn">Přihlásit se</button>
    </form>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submit-btn');
      const errBox = document.getElementById('error-box');
      const pwd = document.getElementById('pwd').value;
      btn.disabled = true;
      btn.innerText = 'Ověřuji...';
      errBox.style.display = 'none';

      try {
        const res = await fetch('/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          window.location.href = '/admin/';
        } else {
          errBox.innerText = data.error || 'Nesprávné heslo.';
          errBox.style.display = 'block';
        }
      } catch (err) {
        errBox.innerText = 'Chyba spojení se serverem.';
        errBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerText = 'Přihlásit se';
      }
    });
  </script>
</body>
</html>`;

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Zpracování /admin/login endpointu
  if (path === '/admin/login' || path === '/admin/login/') {
    if (request.method === 'GET') {
      return new Response(LOGIN_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
    // POST požadavky na /admin/login necháme projít do Netlify Function
    return context.next();
  }

  // 2. Ověření session cookie pro /admin/*
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  const token = match ? match[1] : '';
  const secretKey = Deno.env.get('SECRET_SESSION_KEY') || 'default-session-salt';

  const isValid = token ? await verifyEdgeSession(token, secretKey) : false;

  if (isValid) {
    return context.next();
  }

  // 3. Neplatná relace
  const acceptHeader = request.headers.get('accept') || '';
  const isHtml = acceptHeader.includes('text/html');

  if (request.method === 'GET' && isHtml) {
    return Response.redirect(new URL('/admin/login', request.url), 302);
  }

  return new Response(
    JSON.stringify({ ok: false, error: 'Neautorizovaný přístup do administrace.' }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export const config: Config = {
  path: '/admin/*',
};
