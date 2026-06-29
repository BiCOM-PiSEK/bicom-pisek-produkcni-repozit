/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — HTTP & Response Helpers (F13)
 * ═══════════════════════════════════════════════════════════════
 * Společné utility pro standardizované HTTP odpovědi a zpracování.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Standardizovaný pomocník pro odesílání JSON odpovědí.
 * @param {*} data - Payload odpovědi
 * @param {number} [status=200] - HTTP status kód
 * @param {Object} [headers={}] - Extra hlavičky
 * @returns {Response}
 */
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
