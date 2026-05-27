/**
 * Telegram Bot connector for Cloudflare Workers.
 *
 * Sends HTML-formatted notifications to a default chat.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_TELEGRAM_BOT_TOKEN
 *   - SECRET_TELEGRAM_CHAT_ID
 *
 * @module telegram
 */

import { fetchWithRetry } from './_fetch-retry.js';

export class TelegramConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   */
  constructor(env) {
    this.botToken = env.SECRET_TELEGRAM_BOT_TOKEN || '';
    this.chatId = env.SECRET_TELEGRAM_CHAT_ID || '';
    this.configured = Boolean(this.botToken) && Boolean(this.chatId);
    this.baseUrl = this.botToken
      ? `https://api.telegram.org/bot${this.botToken}`
      : '';
  }

  /**
   * Send a text message to the default chat.
   *
   * @param {string} text - Message text (may contain HTML tags).
   * @param {string} [parseMode='HTML'] - Telegram parse mode ('HTML' or 'MarkdownV2').
   * @returns {Promise<object|null>} Telegram API response or null on failure.
   */
  async sendMessage(text, parseMode = 'HTML') {
    if (!this.configured) {
      console.warn('[Telegram] Missing bot token or chat ID — message not sent.');
      return null;
    }

    const res = await fetchWithRetry(`${this.baseUrl}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
      }),
    });

    if (!res || !res.ok) {
      console.warn('[Telegram] sendMessage failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * Send a formatted booking notification.
   *
   * @param {object} booking - Booking data.
   * @param {string} booking.name - Customer name.
   * @param {string} booking.email - Customer email.
   * @param {string} [booking.phone] - Customer phone.
   * @param {string} booking.service - Service name.
   * @param {string} booking.preferred_date - Preferred date/time string.
   * @param {number} [booking.estimated_price] - Estimated price in CZK.
   * @param {string} [booking.note] - Optional note from the customer.
   * @returns {Promise<object|null>}
   */
  async sendBookingNotification(booking) {
    const lines = [
      '🔔 <b>Nová poptávka</b>',
      `👤 ${escapeHtml(booking.name)}`,
      `📧 ${escapeHtml(booking.email)}`,
      `📱 ${escapeHtml(booking.phone || '—')}`,
      `💆 ${escapeHtml(booking.service)}`,
      `📅 ${escapeHtml(booking.preferred_date)}`,
      `💰 ${booking.estimated_price != null ? `${booking.estimated_price} Kč` : '—'}`,
      `📝 ${escapeHtml(booking.note || '—')}`,
    ];

    return this.sendMessage(lines.join('\n'));
  }

  /**
   * Send an AI advisor escalation notification.
   *
   * @param {string} question - The user question that needs human attention.
   * @param {string} context - Conversation context or summary.
   * @returns {Promise<object|null>}
   */
  async sendEscalation(question, context) {
    const lines = [
      '❓ <b>AI Rádce — eskalace</b>',
      `Otázka: ${escapeHtml(question)}`,
      `Kontext: ${escapeHtml(context)}`,
    ];

    return this.sendMessage(lines.join('\n'));
  }

  /**
   * Send a cash flow alert with week-over-week comparison.
   *
   * @param {object} stats - Cash flow statistics.
   * @param {number} stats.bookings_count - Current week booking count.
   * @param {number} stats.revenue - Current week revenue in CZK.
   * @param {number} stats.prev_bookings_count - Previous week booking count.
   * @param {number} stats.prev_revenue - Previous week revenue in CZK.
   * @returns {Promise<object|null>}
   */
  async sendCashFlowAlert(stats) {
    const change =
      stats.prev_revenue > 0
        ? Math.round(((stats.revenue - stats.prev_revenue) / stats.prev_revenue) * 100)
        : 0;

    const trend = change >= 0 ? '📈' : '📉';

    const lines = [
      '💰 <b>Cash Flow Report</b>',
      `Tento týden: ${stats.bookings_count} rezervací (${stats.revenue} Kč)`,
      `Minulý týden: ${stats.prev_bookings_count} rezervací (${stats.prev_revenue} Kč)`,
      `Trend: ${trend} ${change}%`,
    ];

    // Recommendation when bookings drop significantly
    if (
      stats.prev_bookings_count > 0 &&
      stats.bookings_count < stats.prev_bookings_count * 0.7
    ) {
      lines.push('');
      lines.push(
        '⚠️ <i>Počet rezervací poklesl o více než 30 %. Doporučujeme zvážit propagační akci nebo ověřit dostupnost termínů.</i>',
      );
    }

    return this.sendMessage(lines.join('\n'));
  }

  /**
   * Send a weekly digest summary.
   *
   * @param {object} stats - Weekly statistics.
   * @param {number} stats.count - Total bookings this week.
   * @param {number} stats.revenue - Total revenue in CZK.
   * @param {string} stats.topService - Most popular service name.
   * @param {string} stats.topCity - Most popular city.
   * @param {number} stats.pendingCount - Number of bookings awaiting confirmation.
   * @returns {Promise<object|null>}
   */
  async sendWeeklyDigest(stats) {
    const lines = [
      '📊 <b>Týdenní přehled</b>',
      `Rezervace: ${stats.count}`,
      `Tržby: ${stats.revenue} Kč`,
      `Top služba: ${escapeHtml(stats.topService || '—')}`,
      `Top město: ${escapeHtml(stats.topCity || '—')}`,
      `Čekající potvrzení: ${stats.pendingCount}`,
    ];

    return this.sendMessage(lines.join('\n'));
  }
}

/**
 * Escape special HTML characters for Telegram HTML parse mode.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
