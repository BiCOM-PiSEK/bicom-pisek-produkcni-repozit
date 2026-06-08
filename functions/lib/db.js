import { DataCrypt } from './datacrypt.js';

export const CONSENT_VERSION = '2026-06-08';

/**
 * Strictly parses value to boolean based on CodeRabbit guidelines.
 * Returns true only for true, 1, "1", "true", "yes" (case-insensitive).
 * Otherwise returns false.
 * @param {*} val
 * @returns {boolean}
 */
export function parseBoolean(val) {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const lower = val.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  return false;
}

/**
 * Database helper functions for D1.
 * All sensitive data is encrypted before storage.
 */

/**
 * Creates a new booking record with encrypted sensitive fields.
 * @param {D1Database} db - D1 database binding
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {Object} data - Booking data (name, email, phone, service, note, preferred_date, psc, estimated_price, consent_version, consent_marketing, reminder_channel)
 * @returns {Promise<string>} - The generated booking ID
 */
export async function createBooking(db, crypt, data) {
  const id = crypto.randomUUID();
  const [nameEnc, emailEnc, phoneEnc, noteEnc, emailHash] = await Promise.all([
    crypt.encrypt(data.name),
    crypt.encrypt(data.email),
    crypt.encrypt(data.phone),
    data.note ? crypt.encrypt(data.note) : Promise.resolve(null),
    DataCrypt.hash(data.email.toLowerCase().trim()),
  ]);

  await db.batch([
    db.prepare(
      `INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, estimated_price, consent_version, consent_marketing, reminder_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, nameEnc, emailEnc, phoneEnc, data.service, noteEnc, data.preferred_date, data.psc || null, data.estimated_price || null, data.consent_version || null, data.consent_marketing ? 1 : 0, data.reminder_channel || 'email'),
    db.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'bookings', ?, 'create', 'system', 'New booking created')`
    ).bind(crypto.randomUUID(), id),
  ]);

  return id;
}

/**
 * Confirms a booking and logs the operator action.
 * @param {D1Database} db - D1 database binding
 * @param {string} bookingId - ID of the booking to confirm
 * @param {string} operatorId - ID of the operator performing the action
 * @returns {Promise<void>}
 */
export async function confirmBooking(db, bookingId, operatorId) {
  await db.batch([
    db.prepare(`UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending'`).bind(bookingId),
    db.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'bookings', ?, 'update', ?, 'Status changed to confirmed')`
    ).bind(crypto.randomUUID(), bookingId, `operator:${operatorId}`),
  ]);
}

/**
 * Retrieves and decrypts a booking record.
 * @param {D1Database} db - D1 database binding
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {string} bookingId - ID of the booking to retrieve
 * @returns {Promise<Object|null>} Decrypted booking object, or null if not found
 */
export async function getDecryptedBooking(db, crypt, bookingId) {
  const row = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first();
  if (!row) return null;

  const [name, email, phone, note] = await Promise.all([
    crypt.decrypt(row.name_enc),
    crypt.decrypt(row.email_enc),
    crypt.decrypt(row.phone_enc),
    row.note_enc ? crypt.decrypt(row.note_enc) : Promise.resolve(null),
  ]);

  return { ...row, name, email, phone, note };
}

/**
 * Adds an anonymous geo lead for analytics.
 * Maps PSČ prefix to city name for top Písecko towns.
 * @param {D1Database} db - D1 database binding
 * @param {string|null} psc - Czech postal code (PSČ)
 * @param {string} service - Requested service type
 * @param {string} source - Lead source (e.g. 'web', 'social', 'ai_referral')
 * @returns {Promise<string>} - The generated geo lead ID
 */
export async function addGeoLead(db, psc, service, source) {
  const id = crypto.randomUUID();
  // Simple PSČ → město lookup (top Písecko towns)
  const PSC_MAP = {
    '397': 'Písek', '386': 'Strakonice', '399': 'Milevsko',
    '389': 'Vodňany', '398': 'Protivín', '388': 'Blatná',
  };
  const prefix = psc ? psc.substring(0, 3) : null;
  const city = prefix ? (PSC_MAP[prefix] || 'Jiné') : null;

  await db.prepare(
    `INSERT INTO geo_leads (id, psc, city, service, source) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, psc, city, service, source).run();

  return id;
}

/**
 * Subscribes email to newsletter with encryption and dedup.
 * If already subscribed and unsubscribed, reactivates the subscription.
 * @param {D1Database} db - D1 database binding
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {string} email - Email address to subscribe
 * @param {string} [source='form'] - Subscription source
 * @returns {Promise<string>} - The subscriber ID (existing or new)
 */
export async function subscribeNewsletter(db, crypt, email, source = 'form') {
  const emailHash = await DataCrypt.hash(email.toLowerCase().trim());

  // Check for existing subscription
  const existing = await db.prepare(
    'SELECT id, status FROM newsletter_subscribers WHERE email_hash = ?'
  ).bind(emailHash).first();

  if (existing) {
    if (existing.status === 'unsubscribed') {
      await db.prepare(
        `UPDATE newsletter_subscribers SET status = 'active' WHERE id = ?`
      ).bind(existing.id).run();
    }
    return existing.id;
  }

  const id = crypto.randomUUID();
  const emailEnc = await crypt.encrypt(email);
  await db.prepare(
    `INSERT INTO newsletter_subscribers (id, email_enc, email_hash, source) VALUES (?, ?, ?, ?)`
  ).bind(id, emailEnc, emailHash, source).run();

  return id;
}
