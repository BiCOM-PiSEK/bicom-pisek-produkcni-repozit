/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Lehký HTML sanitizér (Workers runtime)
 * ═══════════════════════════════════════════════════════════════
 * Bez závislosti na DOMPurify/Node (ve Workers není DOM).
 * Obsah zadávají důvěryhodné operátorky za Cloudflare Access, přesto
 * preventivně provádíme XSS hardening:
 *   - odstranění <script>, <style>, <iframe>, <object>, … i s obsahem
 *   - allowlist tagů (formátovací text + odkazy)
 *   - ATRIBUTOVÁ sanitizace: u povolených tagů se zahodí VŠECHNY atributy
 *     kromě bezpečného href na <a> (whitelist schémat http/https/mailto/tel/
 *     relativní/#). Tím padají on*=, style=, i obfuskované javascript: URL.
 * ═══════════════════════════════════════════════════════════════
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'a', 'blockquote', 'small',
]);

const DANGEROUS_BLOCKS = /<\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELFCLOSE = /<\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*\/?>/gi;

// Řídicí znaky + bílé znaky (obrana proti obfuskaci typu "java\nscript:").
const CONTROL_AND_SPACE = /[\u0000-\u0020\u007F\s]+/g;

/**
 * Vrátí bezpečnou URL, nebo '#' pokud schéma není na whitelistu.
 * Povolené: http(s):, mailto:, tel:, relativní cesta („/…"), kotva („#…").
 * @param {string} raw
 * @returns {string}
 */
function sanitizeUrl(raw) {
  const normalized = String(raw || '').replace(CONTROL_AND_SPACE, '').trim();
  return /^(https?:|mailto:|tel:|\/|#)/i.test(normalized) ? normalized : '#';
}

/**
 * Sanitizuje HTML řetězec na bezpečnou podmnožinu (viz hlavička modulu).
 * @param {string} input — vstupní (potenciálně nedůvěryhodné) HTML
 * @param {number} [maxLength=10000] — tvrdý strop délky (10 KB default)
 * @returns {string} bezpečné HTML
 */
export function sanitizeHTML(input, maxLength = 10000) {
  if (input == null) return '';
  let html = String(input);

  if (html.length > maxLength) {
    html = html.slice(0, maxLength);
  }

  // 1) Odstranit celé nebezpečné bloky i jejich obsah
  html = html.replace(DANGEROUS_BLOCKS, '');
  html = html.replace(DANGEROUS_SELFCLOSE, '');

  // 2) Přepsat tagy: neznámé zahodit; u povolených ponechat jen bezpečné atributy.
  //    Tím se zbavíme on*=, style=, a všech URL atributů kromě sanitizovaného href.
  html = html.replace(/<\/?([a-z0-9]+)\b([^>]*)>/gi, (match, tag, attrs = '') => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (match.startsWith('</')) return `</${t}>`;
    if (t !== 'a') return `<${t}>`;
    // <a>: ponechat výhradně sanitizovaný href
    const href = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const safeHref = sanitizeUrl(href ? (href[1] ?? href[2] ?? href[3]) : '#');
    return `<a href="${safeHref}">`;
  });

  return html.trim();
}

/**
 * Vrátí prostý text bez jakýchkoli HTML tagů (pro nadpisy, popisky).
 * @param {string} input
 * @param {number} [maxLength=2000]
 * @returns {string}
 */
export function stripTags(input, maxLength = 2000) {
  if (input == null) return '';
  let text = String(input).replace(/<[^>]*>/g, '');
  if (text.length > maxLength) text = text.slice(0, maxLength);
  return text.trim();
}
