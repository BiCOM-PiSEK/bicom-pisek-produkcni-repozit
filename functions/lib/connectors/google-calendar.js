/**
 * Google Calendar connector for Cloudflare Workers.
 *
 * Uses a Google Service Account with JWT (RS256) authentication
 * via the Web Crypto API. No Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL
 *   - SECRET_GOOGLE_CALENDAR_PRIVATE_KEY (PEM-encoded RSA private key)
 *   - SECRET_GOOGLE_CALENDAR_ID
 *
 * @module google-calendar
 */

import { fetchWithRetry } from './_fetch-retry.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

/**
 * Convert a PEM-encoded RSA private key to a CryptoKey for signing.
 *
 * @param {string} pem - PEM-encoded PKCS#8 private key.
 * @returns {Promise<CryptoKey>}
 */
async function importPrivateKey(pem) {
  // Strip PEM headers, whitespace, and decode base64
  const pemBody = pem
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
 *
 * @param {string|ArrayBuffer} input
 * @returns {string}
 */
function base64url(input) {
  let str;
  if (typeof input === 'string') {
    str = btoa(input);
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

export class GoogleCalendarConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    this.clientEmail = env.SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL || '';
    this.privateKeyPem = env.SECRET_GOOGLE_CALENDAR_PRIVATE_KEY || '';
    this.calendarId = env.SECRET_GOOGLE_CALENDAR_ID || '';
    this.configured =
      Boolean(this.clientEmail) &&
      Boolean(this.privateKeyPem) &&
      Boolean(this.calendarId);

    // In-memory token cache
    /** @type {string|null} */
    this._accessToken = null;
    /** @type {number} */
    this._tokenExpiry = 0;
  }

  /**
   * Obtain an access token using JWT Service Account flow.
   * Caches the token in-memory until it expires.
   *
   * @returns {Promise<string|null>} The OAuth2 access token, or null if not configured.
   */
  async _getAccessToken() {
    if (!this.configured) {
      console.warn('[GoogleCalendar] Missing credentials — skipping auth.');
      return null;
    }

    // Return cached token if still valid (with 60s safety margin)
    const now = Math.floor(Date.now() / 1000);
    if (this._accessToken && now < this._tokenExpiry - 60) {
      return this._accessToken;
    }

    // Build JWT
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

    // Exchange JWT for access token
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
      console.warn('[GoogleCalendar] Token exchange failed:', res?.status);
      return null;
    }

    const data = await res.json();
    this._accessToken = data.access_token;
    this._tokenExpiry = now + (data.expires_in || 3600);
    return this._accessToken;
  }

  /**
   * Insert a new event into the calendar.
   *
   * @param {object} event - Event data.
   * @param {string} event.summary - Event title.
   * @param {string} [event.description] - Event description.
   * @param {{dateTime: string, timeZone: string}} event.start - Start time.
   * @param {{dateTime: string, timeZone: string}} event.end - End time.
   * @param {string} [event.colorId] - Color ID: '5' = yellow (pending), '2' = green (confirmed).
   * @returns {Promise<object|null>} Created event data or null on failure.
   */
  async insertEvent(event) {
    const token = await this._getAccessToken();
    if (!token) return null;

    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(this.calendarId)}/events`;

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!res || !res.ok) {
      console.warn('[GoogleCalendar] insertEvent failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * Update the color of an existing event.
   *
   * @param {string} eventId - Google Calendar event ID.
   * @param {string} colorId - Color ID: '5' = yellow (pending), '2' = green (confirmed).
   * @returns {Promise<object|null>} Updated event data or null on failure.
   */
  async updateEventColor(eventId, colorId) {
    const token = await this._getAccessToken();
    if (!token) return null;

    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`;

    const res = await fetchWithRetry(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ colorId }),
    });

    if (!res || !res.ok) {
      console.warn('[GoogleCalendar] updateEventColor failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * List events in a time range.
   *
   * @param {string} timeMin - RFC 3339 start time (inclusive).
   * @param {string} timeMax - RFC 3339 end time (exclusive).
   * @returns {Promise<object[]>} Array of event objects, or empty array on failure.
   */
  async listEvents(timeMin, timeMax) {
    const token = await this._getAccessToken();
    if (!token) return [];

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`;

    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res || !res.ok) {
      console.warn('[GoogleCalendar] listEvents failed:', res?.status);
      return [];
    }

    const data = await res.json();
    return data.items || [];
  }
}
