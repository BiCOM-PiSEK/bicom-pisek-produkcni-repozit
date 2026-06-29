/**
 * Google Search Console connector for Cloudflare Workers.
 *
 * Uses a Google Service Account with JWT (RS256) authentication
 * via the Web Crypto API. No Node.js dependencies.
 *
 * Required secrets:
 *   - env.GSC_SERVICE_ACCOUNT_JSON (JSON credentials from Google Service Account, potentially wrapped in double quotes)
 *
 * @module google-search-console
 */

import { fetchWithRetry } from './_fetch-retry.js';

const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/**
 * Parses the service account JSON secret, tolerating wrapping quotes.
 */
function parseServiceAccount(rawSecret) {
  if (!rawSecret) return null;
  let cleanSecret = rawSecret.trim();
  if (cleanSecret.startsWith('"') && cleanSecret.endsWith('"')) {
    try {
      const parsed = JSON.parse(cleanSecret);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
      cleanSecret = parsed;
    } catch (e) {
      cleanSecret = cleanSecret.slice(1, -1);
    }
  }
  try {
    return JSON.parse(cleanSecret);
  } catch (e) {
    console.error('[GoogleSearchConsole] Failed to parse service account JSON:', e);
    return null;
  }
}

/**
 * Convert a PEM-encoded RSA private key to a CryptoKey for signing.
 */
async function importPrivateKey(pem) {
  const normalizedPem = pem.replace(/\\n/g, '\n');
  const pemBody = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');

  const binaryStr = atob(pemBody);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Base64url-encode a string or ArrayBuffer.
 */
function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(unescape(encodeURIComponent(input)));
  } else {
    const bytes = new Uint8Array(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Module-level token cache — persists across requests within the same isolate.
// Keyed by service-account client_email so multiple accounts won't collide.
const _tokenCache = new Map();

export class GoogleSearchConsoleConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    const creds = parseServiceAccount(env.GSC_SERVICE_ACCOUNT_JSON);
    
    this.clientEmail = creds?.client_email || '';
    this.privateKeyPem = creds?.private_key || '';
    this.projectId = creds?.project_id || '';
    this.siteUrl = env.GSC_SITE_URL || 'https://bicom-pisek.cz';
    
    this.configured =
      Boolean(this.clientEmail) &&
      Boolean(this.privateKeyPem) &&
      Boolean(this.siteUrl);
  }

  /**
   * Obtain access token using JWT flow.
   */
  async _getAccessToken() {
    if (!this.configured) {
      console.warn('[GoogleSearchConsole] Missing credentials — skipping auth.');
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const cached = _tokenCache.get(this.clientEmail);
    if (cached && now < cached.expiry - 60) {
      return cached.token;
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: this.clientEmail,
      scope: SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const key = await importPrivateKey(this.privateKeyPem);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(signingInput),
    );

    const jwt = `${signingInput}.${base64url(signature)}`;

    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    });

    const res = await fetchWithRetry(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res || !res.ok) {
      console.warn('[GoogleSearchConsole] Token exchange failed:', res?.status);
      return null;
    }

    const data = await res.json();
    _tokenCache.set(this.clientEmail, {
      token: data.access_token,
      expiry: now + (data.expires_in || 3600),
    });
    return data.access_token;
  }

  /**
   * Queries search console analytics.
   *
   * @param {object} options
   * @param {string} options.startDate - YYYY-MM-DD
   * @param {string} options.endDate - YYYY-MM-DD
   * @param {number} [options.rowLimit] - Max rows
   * @returns {Promise<Array<object>>}
   */
  async getSearchAnalytics({ startDate, endDate, rowLimit = 250 }) {
    const token = await this._getAccessToken();
    if (!token) {
      throw new Error('Google Search Console API authentication failed.');
    }

    const encodedSite = encodeURIComponent(this.siteUrl);
    const endpoint = `${GSC_API_BASE}/sites/${encodedSite}/searchAnalytics/query`;

    const requestBody = {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    };

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res || !res.ok) {
      const errText = res ? await res.text() : 'No response';
      console.error('[GoogleSearchConsole] Query failed:', res?.status, errText);
      throw new Error(`Google Search Console API query failed: ${res?.status || '502'}`);
    }

    const data = await res.json();
    return (data.rows || []).map(row => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }));
  }
}
