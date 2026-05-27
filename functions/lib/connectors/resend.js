/**
 * Resend email connector for Cloudflare Workers.
 *
 * Sends transactional HTML emails via the Resend API.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_RESEND_API_KEY
 *
 * @module resend
 */

import { fetchWithRetry } from './_fetch-retry.js';

const RESEND_API = 'https://api.resend.com/emails';
const BUSINESS_ADDRESS = 'Bicom Písek, Nádražní 2512, 397 01 Písek';

export class ResendConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    this.apiKey = env.SECRET_RESEND_API_KEY || '';
    this.configured = Boolean(this.apiKey);
    this.fromEmail = 'Bicom Písek <info@bicompisek.cz>';
  }

  /**
   * Send an email via Resend.
   *
   * @param {string|string[]} to - Recipient email address(es).
   * @param {string} subject - Email subject line.
   * @param {string} htmlBody - Email body in HTML.
   * @returns {Promise<object|null>} Resend API response or null on failure.
   */
  async sendEmail(to, subject, htmlBody) {
    if (!this.configured) {
      console.warn('[Resend] Missing API key — email not sent.');
      return null;
    }

    const res = await fetchWithRetry(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: htmlBody,
      }),
    });

    if (!res || !res.ok) {
      console.warn('[Resend] sendEmail failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * Send a booking confirmation email with preparation instructions.
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.email - Customer email.
   * @param {string} booking.name - Customer name.
   * @param {string} booking.service - Service name.
   * @param {string} booking.confirmed_date - Confirmed date/time string.
   * @param {number} [booking.estimated_price] - Estimated price in CZK.
   * @returns {Promise<object|null>}
   */
  async sendBookingConfirmation(booking) {
    const subject = `Potvrzení termínu — ${booking.service}`;

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: #f0f7f0; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
    <h2 style="color: #2d7a3a; margin: 0 0 8px;">✅ Váš termín je potvrzen</h2>
    <p style="margin: 0;">Dobrý den, <strong>${escapeHtml(booking.name)}</strong>,</p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Služba:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.service)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Termín:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.confirmed_date)}</td>
    </tr>
    ${booking.estimated_price != null ? `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Odhadovaná cena:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${booking.estimated_price} Kč</td>
    </tr>` : ''}
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adresa:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${BUSINESS_ADDRESS}</td>
    </tr>
  </table>

  <div style="background: #fff8e1; padding: 16px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 16px;">
    <h3 style="margin: 0 0 8px; color: #f57f17;">📋 Příprava na terapii</h3>
    <ul style="margin: 0; padding-left: 20px;">
      <li>24 hodin před terapií nepijte <strong>kávu</strong> ani <strong>alkohol</strong></li>
      <li>Přijďte odpočatí a dobře hydratovaní</li>
      <li>Vezměte si pohodlné oblečení</li>
      <li>V případě užívání léků informujte terapeuta</li>
    </ul>
  </div>

  <p>Pokud potřebujete termín změnit nebo zrušit, kontaktujte nás prosím co nejdříve.</p>

  <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    ${BUSINESS_ADDRESS}<br>
    Tento e-mail byl vygenerován automaticky.
  </p>
</body>
</html>`.trim();

    return this.sendEmail(booking.email, subject, html);
  }

  /**
   * Send a booking reminder email (T-24h).
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.email - Customer email.
   * @param {string} booking.name - Customer name.
   * @param {string} booking.service - Service name.
   * @param {string} booking.confirmed_date - Confirmed date/time string.
   * @returns {Promise<object|null>}
   */
  async sendBookingReminder(booking) {
    const subject = `Připomínka zítřejšího termínu — ${booking.service}`;

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: #e3f2fd; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
    <h2 style="color: #1565c0; margin: 0 0 8px;">⏰ Připomínka termínu</h2>
    <p style="margin: 0;">Dobrý den, <strong>${escapeHtml(booking.name)}</strong>,</p>
  </div>

  <p>Rádi bychom Vám připomněli Váš <strong>zítřejší termín</strong>:</p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Služba:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.service)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Termín:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.confirmed_date)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adresa:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${BUSINESS_ADDRESS}</td>
    </tr>
  </table>

  <div style="background: #fff8e1; padding: 16px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 16px;">
    <p style="margin: 0;"><strong>Nezapomeňte:</strong> 24 hodin před terapií nepijte kávu ani alkohol.</p>
  </div>

  <p>Těšíme se na Vás!</p>

  <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    ${BUSINESS_ADDRESS}<br>
    Tento e-mail byl vygenerován automaticky.
  </p>
</body>
</html>`.trim();

    return this.sendEmail(booking.email, subject, html);
  }
}

/**
 * Escape special HTML characters.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
