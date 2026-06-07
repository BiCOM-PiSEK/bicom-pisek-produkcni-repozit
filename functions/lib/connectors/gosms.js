/**
 * GoSMS.cz SMS connector for Cloudflare Workers.
 *
 * Sends SMS messages via the GoSMS API.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_SMS_GATEWAY_CLIENT_ID
 *   - SECRET_SMS_GATEWAY_CLIENT_SECRET
 *
 * Required bindings:
 *   - CACHE (KV namespace for token caching)
 *
 * @module gosms
 */

import { fetchWithRetry } from './_fetch-retry.js';

const TOKEN_ENDPOINT = 'https://app.gosms.cz/oauth/v2/token';
const GOSMS_API = 'https://app.gosms.cz/api/v1/messages';
const KV_TOKEN_KEY = 'gosms_token';
const MAX_SMS_LENGTH = 160;

export class GoSmsConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   * @param {object} [kvCache] - KV namespace for caching tokens (defaults to env.CACHE).
   */
  constructor(env, kvCache) {
    this.clientId = env.SECRET_SMS_GATEWAY_CLIENT_ID || '';
    this.clientSecret = env.SECRET_SMS_GATEWAY_CLIENT_SECRET || '';
    this.kvCache = kvCache || env.CACHE || null;
    this.configured = Boolean(this.clientId) && Boolean(this.clientSecret);
  }

  /**
   * Obtain an access token via client_credentials grant.
   * Checks KV cache first; if expired, requests a new token and caches it.
   *
   * @returns {Promise<string|null>} The access token or null if not configured/failed.
   */
  async _getAccessToken() {
    if (!this.configured) {
      console.warn('[GoSMS] Missing client credentials — skipping auth.');
      return null;
    }

    // Try KV cache first
    if (this.kvCache) {
      try {
        const cached = await this.kvCache.get(KV_TOKEN_KEY);
        if (cached) return cached;
      } catch (e) {
        console.warn('[GoSMS] KV cache read error:', e.message);
      }
    }

    // Request new token
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetchWithRetry(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res || !res.ok) {
      console.warn('[GoSMS] Token request failed:', res?.status);
      return null;
    }

    try {
      const data = await res.json();
      const token = data.access_token;
      if (!token) {
        console.warn('[GoSMS] No access token in response');
        return null;
      }
      const ttl = (data.expires_in || 3600) - 60; // 60s safety margin

      // Cache in KV
      if (this.kvCache) {
        try {
          await this.kvCache.put(KV_TOKEN_KEY, token, { expirationTtl: Math.max(ttl, 60) });
        } catch (e) {
          console.warn('[GoSMS] KV cache write error:', e.message);
        }
      }

      return token;
    } catch (e) {
      console.warn('[GoSMS] Failed to parse token response:', e.message);
      return null;
    }
  }

  /**
   * Send an SMS message.
   *
   * @param {string} phoneNumber - Recipient phone number (international format recommended).
   * @param {string} text - SMS text content (max 160 characters for a single SMS segment).
   * @returns {Promise<object|null>} GoSMS API response or null on failure.
   */
  async sendSms(phoneNumber, text) {
    if (!this.configured) {
      console.warn('[GoSMS] Missing client credentials — SMS not sent.');
      return null;
    }

    const token = await this._getAccessToken();
    if (!token) {
      console.warn('[GoSMS] Authentication failed — SMS not sent.');
      return null;
    }

    if (text.length > MAX_SMS_LENGTH) {
      console.warn(
        `[GoSMS] Message length (${text.length}) exceeds ${MAX_SMS_LENGTH} chars — may be split into multiple segments.`,
      );
    }

    const res = await fetchWithRetry(GOSMS_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
        recipients: phoneNumber,
        channel: 1,
      }),
    });

    if (!res || !res.ok) {
      console.warn('[GoSMS] sendSms failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * Send a booking reminder SMS (T-24h).
   * Keeps the message under 160 characters.
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.phone - Customer phone number.
   * @param {string} booking.time - Appointment time string (e.g. "10:00").
   * @param {string} [booking.address] - Business address.
   * @returns {Promise<object|null>}
   */
  async sendBookingReminder(booking) {
    const address = booking.address || 'Vladislavova 201, 397 01 Písek';
    const text = `Bicom Pisek: Pripominame Vas zitrejsi termin v ${booking.time}. Adresa: ${address}. Tesime se na Vas.`;

    return this.sendSms(booking.phone, text);
  }
}
