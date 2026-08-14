// netlify/functions/admin-login.js
// Správa přihlášení a odhlášení administrátora pro Virtual Office.

import { createSessionToken } from '../lib/admin-auth.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);

  // Odhlášení (/admin/logout)
  if (url.pathname.endsWith('/logout') || url.searchParams.get('action') === 'logout') {
    return new Response(
      JSON.stringify({ ok: true, message: 'Byli jste úspěšně odhlášeni.' }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Set-Cookie': 'admin_session=; Path=/admin; Max-Age=0; HttpOnly; SameSite=Lax; Secure',
        },
      }
    );
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = await request.json();
    const password = body.password || '';
    const expectedPassword = process.env.SECRET_ADMIN_PASSWORD || 'Bicom-@26';

    if (password !== expectedPassword) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Nesprávné heslo.' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const sessionSecret = process.env.SECRET_SESSION_KEY || 'default-session-salt';
    const sessionToken = await createSessionToken(sessionSecret, 'op_admin_box');

    return new Response(
      JSON.stringify({
        ok: true,
        token: sessionToken,
        message: 'Přihlášení proběhlo úspěšně.',
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Set-Cookie': `admin_session=${sessionToken}; Path=/admin; Max-Age=86400; HttpOnly; SameSite=Lax; Secure`,
        },
      }
    );
  } catch (err) {
    console.error('[admin-login] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při přihlašování.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/login',
};
