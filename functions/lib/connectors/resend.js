/**
 * Resend email connector for Cloudflare Workers.
 *
 * Sends transactional HTML emails via the Resend API.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - RESEND_API_KEY or SECRET_RESEND_API_KEY
 *
 * @module resend
 */

import { fetchWithRetry } from './_fetch-retry.js';

const RESEND_API = 'https://api.resend.com/emails';
const BUSINESS_ADDRESS = 'Bicom Písek, Vladislavova 201 (technologický park), 397 01 Písek';

export class ResendConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    this.apiKey = env.RESEND_API_KEY || env.SECRET_RESEND_API_KEY || '';
    this.configured = Boolean(this.apiKey);
    this.fromEmail = 'Bicom Písek <info@bicom-pisek.cz>';
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
   * @param {string} booking.date - Appointment date string (e.g. "10. 6. 2026").
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
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.date)}${booking.time ? ` ${escapeHtml(booking.time)}` : ''}</td>
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
   * Send a booking reschedule notification (termín byl přesunut).
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.email - Customer email.
   * @param {string} booking.name - Customer name.
   * @param {string} booking.service - Service name.
   * @param {string} booking.date - New appointment date string (e.g. "20. 6. 2026").
   * @param {string} [booking.time] - New time (optional, e.g. "14:00").
   * @returns {Promise<object|null>}
   */
  async sendBookingRescheduled(booking) {
    const subject = `Změna termínu — ${booking.service}`;

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: #faf8f3; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
    <h2 style="color: #6b5b4d; margin: 0 0 8px;">📅 Změna termínu</h2>
    <p style="margin: 0;">Dobrý den, <strong>${escapeHtml(booking.name)}</strong>,</p>
  </div>

  <p>Váš termín byl přesunut na nový čas:</p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Služba:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.service)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Nový termín:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.date)}${booking.time ? ` ${escapeHtml(booking.time)}` : ''}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adresa:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${BUSINESS_ADDRESS}</td>
    </tr>
  </table>

  <p>Pokud máte nějaké otázky, kontaktujte nás prosím co nejdříve.</p>

  <p style="color: #888; font-size: 12px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 12px;">
    ${BUSINESS_ADDRESS}<br>
    Tento e-mail byl vygenerován automaticky.
  </p>
</body>
</html>`.trim();

    return this.sendEmail(booking.email, subject, html);
  }

  /**
   * Send a booking cancellation notification.
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.email - Customer email.
   * @param {string} booking.name - Customer name.
   * @param {string} booking.service - Service name.
   * @param {string} booking.date - Cancelled appointment date (e.g. "20. 6. 2026").
   * @returns {Promise<object|null>}
   */
  async sendBookingCancelled(booking) {
    const subject = `Zrušení termínu — ${booking.service}`;

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: #fce8e6; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
    <h2 style="color: #c5221f; margin: 0 0 8px;">❌ Zrušení termínu</h2>
    <p style="margin: 0;">Dobrý den, <strong>${escapeHtml(booking.name)}</strong>,</p>
  </div>

  <p>Váš termín byl zrušen:</p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Služba:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.service)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Zrušený termín:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.date)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adresa:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${BUSINESS_ADDRESS}</td>
    </tr>
  </table>

  <p>Pokud si přejete sjednat nový termín, kontaktujte nás prosím. Jsme připraveni vám pomoci.</p>

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
   * @param {string} booking.date - Appointment date string (e.g. "10. 6. 2026").
   * @returns {Promise<object|null>}
   */
  async sendBookingReminder(booking) {
    const subject = `Připomínka termínu — ${booking.service}`;

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: #e3f2fd; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
    <h2 style="color: #1565c0; margin: 0 0 8px;">⏰ Připomínka rezervace</h2>
    <p style="margin: 0;">Dobrý den, <strong>${escapeHtml(booking.name)}</strong>,</p>
  </div>

  <p>Rádi bychom Vám připomněli Vaši <strong>rezervaci</strong>:</p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Služba:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.service)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Datum:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${escapeHtml(booking.date)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Adresa:</strong></td>
      <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${BUSINESS_ADDRESS}</td>
    </tr>
  </table>

  <p>Přesný čas s Vámi domluvíme telefonicky, případně jej již máte potvrzený samostatně.</p>

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

  /**
   * Send admin welcome email with Virtual Office access instructions.
   *
   * @param {object} admin - Admin user data.
   * @param {string} admin.email - Admin email.
   * @param {string} admin.name - Admin name.
   * @returns {Promise<object|null>}
   */
  async sendAdminWelcome(admin) {
    const subject = 'Vítejte v Bicom Písek Virtual Office';

    const html = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Montserrat', Arial, sans-serif; color: #2B2B2B; line-height: 1.6; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #3A4A3C 0%, #627562 100%); padding: 32px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
    <h1 style="color: #FFFFFF; margin: 0 0 8px; font-size: 28px; font-family: 'Cormorant Garamond', Georgia, serif;">Bicom Písek</h1>
    <p style="color: #E8D5B8; margin: 0; font-size: 14px;">Virtual Office — Administrační konzole</p>
  </div>

  <div style="background: #FAF8F5; padding: 24px; border-radius: 10px; margin-bottom: 24px;">
    <h2 style="color: #3A4A3C; margin: 0 0 16px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px;">Vítejte, ${escapeHtml(admin.name)}!</h2>
    <p style="margin: 0 0 12px;">Byl/a jste přidán/a do administrační konzole <strong>Bicom Písek</strong> s rolí <strong>správce (admin)</strong>.</p>
    <p style="margin: 0;">Můžete nyní spravovat rezervace, obsah, galerie, faktury a další aspekty virtuální ordinace.</p>
  </div>

  <div style="background: #EFF6EF; padding: 20px; border-radius: 8px; border-left: 4px solid #5A8A5C; margin-bottom: 24px;">
    <h3 style="color: #3A4A3C; margin: 0 0 12px; font-size: 16px;">🚀 Jak začít:</h3>
    <ol style="margin: 0; padding-left: 20px; color: #2B2B2B;">
      <li style="margin-bottom: 8px;">
        <strong>Otevřete konzoli:</strong> <a href="https://bicom-pisek.cz/admin" style="color: #5A8A5C; text-decoration: underline;">https://bicom-pisek.cz/admin</a>
      </li>
      <li style="margin-bottom: 8px;">
        <strong>Přihlaste se:</strong> Použijte tento e-mail a klikněte "Poslat přihlašovací kód"
      </li>
      <li style="margin-bottom: 8px;">
        <strong>Ověřte se:</strong> Zadejte jednorázový kód z e-mailu
      </li>
      <li>
        <strong>Začněte:</strong> Přistupte k modulům (Kalendář, Obsah, Galerie, Faktury, atd.)
      </li>
    </ol>
  </div>

  <div style="background: #FDF8ED; padding: 20px; border-radius: 8px; border-left: 4px solid #D4A843; margin-bottom: 24px;">
    <h3 style="color: #3A4A3C; margin: 0 0 12px; font-size: 16px;">⚙️ Co můžete dělat:</h3>
    <ul style="margin: 0; padding-left: 20px; color: #2B2B2B;">
      <li style="margin-bottom: 6px;">📅 <strong>Správa rezervací</strong> — Přijímání, přesunování a potvrzování termínů</li>
      <li style="margin-bottom: 6px;">📝 <strong>Správa obsahu</strong> — Úpravy textu, obrázků a obsahu webu</li>
      <li style="margin-bottom: 6px;">🖼️ <strong>Galerie</strong> — Nahrávání a organizace fotografií</li>
      <li style="margin-bottom: 6px;">📰 <strong>Blog &amp; AI</strong> — Vytváření a publikování příspěvků</li>
      <li style="margin-bottom: 6px;">💳 <strong>Faktury a platby</strong> — Sledování transakcí a vydávání faktur</li>
      <li>📍 <strong>GEO-Marketing</strong> — Lokální cílení a geografické kampanie</li>
    </ul>
  </div>

  <div style="background: #EDF3F8; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
    <h3 style="color: #3A4A3C; margin: 0 0 12px; font-size: 16px;">❓ Potřebujete pomoc?</h3>
    <p style="margin: 0 0 8px;">Pro technickou podporu nebo otázky kontaktujte prosím:</p>
    <p style="margin: 0; font-weight: bold;">📧 <a href="mailto:support@meverik.studio" style="color: #5B7FA6; text-decoration: none;">support@meverik.studio</a></p>
  </div>

  <p style="color: #738A75; font-size: 12px; text-align: center; margin-top: 32px; border-top: 1px solid #EAEFE9; padding-top: 16px;">
    Bicom Písek • Virtual Office v1.0<br>
    ${BUSINESS_ADDRESS}<br>
    <span style="color: #999;">Tento e-mail byl odeslán automaticky.</span>
  </p>
</body>
</html>`.trim();

    return this.sendEmail(admin.email, subject, html);
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
