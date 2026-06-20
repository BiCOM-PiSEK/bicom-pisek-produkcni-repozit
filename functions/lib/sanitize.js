/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Lehký HTML sanitizér (Workers runtime)
 * ═══════════════════════════════════════════════════════════════
 * Bez závislosti na DOMPurify/Node (ve Workers není DOM).
 * Obsah zadávají důvěryhodné operátorky za Cloudflare Access, přesto
 * preventivně odstraňujeme nebezpečné konstrukce (XSS hardening):
 *   - <script>, <style>, <iframe>, <object>, <embed>, <form> a podobné
 *   - on*="..." event handlery
 *   - javascript:/data: URL ve href/src
 * Allowlist tagů je vědomě konzervativní (formátovací text + odkazy).
 * ═══════════════════════════════════════════════════════════════
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span',
  'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'a', 'blockquote', 'small',
]);

const DANGEROUS_BLOCKS = /<\s*(script|style|iframe|object|embed|form|link|meta|base|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_SELFCLOSE = /<\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*\/?>/gi;

/**
 * Sanitizuje HTML řetězec na bezpečnou podmnožinu.
 * @param {string} input
 * @param {number} [maxLength=10000] — tvrdý strop délky (10 KB default)
 * @returns {string}
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

  // 2) Odstranit on*="..." / on*='...' / on*=... event handlery
  html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 3) Zneškodnit nebezpečné URL schémata v href/src — uvozovkové i BEZ uvozovek
  //    (např. <a href=javascript:alert(1)> by jinak prošlo)
  html = html.replace(/\b(href|src)\s*=\s*(["'])\s*(?:javascript:|data:|vbscript:)[^"']*\2/gi, '$1="#"');
  html = html.replace(/\b(href|src)\s*=\s*(?:javascript:|data:|vbscript:)[^\s>]*/gi, '$1="#"');

  // 4) Odstranit neznámé tagy (ponechat jejich textový obsah)
  html = html.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match, tag) => {
    return ALLOWED_TAGS.has(tag.toLowerCase()) ? match : '';
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
