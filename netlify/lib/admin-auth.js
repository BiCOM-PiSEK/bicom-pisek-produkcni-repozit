// netlify/lib/admin-auth.js
// Správa administrátorských relací a ověřování operátorů pro Netlify Functions.

import { getSupabaseAdmin } from './supabase.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hodin

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Vytvoří podepsaný session token pro administrátora.
 * @param {string} secretKey
 * @param {string} [operatorId='op_admin_box']
 * @returns {Promise<string>}
 */
export async function createSessionToken(secretKey, operatorId = 'op_admin_box') {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey || 'default-session-salt');
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payload = JSON.stringify({
    sub: operatorId,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  });

  const encodedPayload = base64UrlEncode(payload);
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(encodedPayload)
  );

  const encodedSignature = Buffer.from(signatureBuffer).toString('base64url');
  return `${encodedPayload}.${encodedSignature}`;
}

/**
 * Ověří platnost podepsaného session tokenu.
 * @param {string} token
 * @param {string} secretKey
 * @returns {Promise<{valid: boolean, operatorId?: string}>}
 */
export async function verifySessionToken(token, secretKey) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false };
  }

  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    return { valid: false };
  }

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

    const signatureBytes = Buffer.from(encodedSignature, 'base64url');
    const isValidSignature = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      encoder.encode(encodedPayload)
    );

    if (!isValidSignature) {
      return { valid: false };
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (Date.now() > payload.exp) {
      return { valid: false };
    }

    return { valid: true, operatorId: payload.sub };
  } catch (err) {
    console.warn('[admin-auth] Token verify error:', err.message);
    return { valid: false };
  }
}

/**
 * Získá session cookie z hlaviček požadavku.
 * @param {Request} request
 * @returns {string|null}
 */
export function getSessionCookie(request) {
  const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/admin_session=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Ověří operátora z HTTP požadavku (z cookie nebo Authorization hlavičky).
 * @param {Request} request
 * @returns {Promise<Object|null>}
 */
export async function authenticateOperator(request) {
  const sessionSecret = process.env.SECRET_SESSION_KEY || 'default-session-salt';

  // 1. Zkusíme cookie
  let token = getSessionCookie(request);

  // 2. Případně Bearer token
  if (!token) {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) return null;

  const result = await verifySessionToken(token, sessionSecret);
  if (!result.valid) return null;

  // 3. Načteme profil operátora ze Supabase
  try {
    const supabase = getSupabaseAdmin();
    const { data: op } = await supabase
      .from('operators')
      .select('id, name, email, role, active')
      .eq('id', result.operatorId || 'op_admin_box')
      .maybeSingle();

    if (op && op.active) {
      return op;
    }
  } catch (err) {
    console.warn('[admin-auth] Operator fetch error:', err.message);
  }

  // Výchozí fallback operátor
  return {
    id: result.operatorId || 'op_admin_box',
    name: 'Hlavní správce',
    email: 'admin@bicom-pisek.cz',
    role: 'Administrátor',
  };
}
