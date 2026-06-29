/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Timezone & Time Helpers (F12)
 * ═══════════════════════════════════════════════════════════════
 * Společné utility pro práci s časem, časovými pásmy a formátováním
 * v kontextu časového pásma Europe/Prague.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Parse YYYY-MM-DD into local Prague date (midnight).
 */
export function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Get current time in Prague timezone.
 */
export function getNowInPrague() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach(({ type, value }) => {
    dateObj[type] = value;
  });
  const year = parseInt(dateObj.year, 10);
  const month = parseInt(dateObj.month, 10) - 1;
  const day = parseInt(dateObj.day, 10);
  const hour = parseInt(dateObj.hour, 10);
  const minute = parseInt(dateObj.minute, 10);
  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Format time as "HH:MM".
 */
export function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format date as "YYYY-MM-DD".
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * Format datetime as "YYYY-MM-DD HH:MM".
 */
export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Add minutes to a date.
 */
export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Add days to a date (in local context).
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
