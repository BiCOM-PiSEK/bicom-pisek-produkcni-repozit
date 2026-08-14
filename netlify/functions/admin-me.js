// netlify/functions/admin-me.js
// Vrací profil přihlášeného operátora.

import { authenticateOperator } from '../lib/admin-auth.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const operator = await authenticateOperator(request);
  if (!operator) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Neautorizovaný přístup.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        role: operator.role,
      },
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}

export const config = {
  path: '/admin/me',
};
