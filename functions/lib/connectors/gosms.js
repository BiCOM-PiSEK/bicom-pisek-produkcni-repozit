/**
 * GoSMS.cz SMS connector for Cloudflare Workers.
 *
 * Sends SMS messages via the GoSMS API.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_SMS_GATEWAY_API_KEY
 *
 * @module gosms
 */

import { fetchWithRetry } from './_fetch-retry.js';

const GOSMS_API = 'https://app.gosms.cz/api/v1/messages';
const MAX_SMS_LENGTH = 160;

export class GoSmsConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    this.apiKey = env.SECRET_SMS_GATEWAY_API_KEY || '';
    this.configured = Boolean(this.apiKey);
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
      console.warn('[GoSMS] Missing API key — SMS not sent.');
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
        Authorization: `Bearer ${this.apiKey}`,
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
    const address = booking.address || 'Nádražní 2512, Písek';
    const text = `Bicom Pisek: Pripominame Vas zitrejsi termin v ${booking.time}. Adresa: ${address}. Tesime se na Vas.`;

    return this.sendSms(booking.phone, text);
  }
}
