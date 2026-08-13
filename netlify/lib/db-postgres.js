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
 * Database helper functions for PostgreSQL (Netlify + Neon).
 * All sensitive data is encrypted before storage.
 */

/**
 * Creates a new booking record with encrypted sensitive fields.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any, any>} sql - PostgreSQL tagged template function
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {Object} data - Booking data
 * @returns {Promise<string>} - The generated booking ID
 */
export async function createBooking(sql, crypt, data) {
  const id = crypto.randomUUID();
  const [nameEnc, emailEnc, phoneEnc, noteEnc, emailHash] = await Promise.all([
    crypt.encrypt(data.name),
    crypt.encrypt(data.email),
    crypt.encrypt(data.phone),
    data.note ? crypt.encrypt(data.note) : Promise.resolve(null),
    DataCrypt.keyedHash(data.email.toLowerCase().trim(), crypt.oldestKeyHex),
  ]);

  const consentMarketing = data.consent_marketing ? 1 : 0;
  const reminderChannel = data.reminder_channel || 'email';
  const psc = data.psc || null;
  const estimatedPrice = data.estimated_price || null;
  const consentVersion = data.consent_version || null;

  // Transakce
  await sql.begin(async (sql) => {
    await sql`
      INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, estimated_price, consent_version, consent_marketing, reminder_channel, email_hash)
      VALUES (${id}, ${nameEnc}, ${emailEnc}, ${phoneEnc}, ${data.service}, ${noteEnc}, ${data.preferred_date}, ${psc}, ${estimatedPrice}, ${consentVersion}, ${consentMarketing}, ${reminderChannel}, ${emailHash})
    `;
    
    await sql`
      INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
      VALUES (${crypto.randomUUID()}, 'bookings', ${id}, 'create', 'system', 'New booking created')
    `;
  });

  return id;
}

/**
 * Confirms a booking and logs the operator action.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any, any>} sql
 * @param {string} bookingId - ID of the booking to confirm
 * @param {string} operatorId - ID of the operator performing the action
 * @returns {Promise<void>}
 */
export async function confirmBooking(sql, bookingId, operatorId) {
  await sql.begin(async (sql) => {
    await sql`UPDATE bookings SET status = 'confirmed' WHERE id = ${bookingId} AND status = 'pending'`;
    
    await sql`
      INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
      VALUES (${crypto.randomUUID()}, 'bookings', ${bookingId}, 'update', ${'operator:' + operatorId}, 'Status changed to confirmed')
    `;
  });
}

/**
 * Retrieves and decrypts a booking record.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any, any>} sql
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {string} bookingId - ID of the booking to retrieve
 * @returns {Promise<Object|null>} Decrypted booking object, or null if not found
 */
export async function getDecryptedBooking(sql, crypt, bookingId) {
  const [row] = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
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
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any, any>} sql
 * @param {string|null} psc - Czech postal code (PSČ)
 * @param {string} service - Requested service type
 * @param {string} source - Lead source
 * @param {Object} geo - Geolocation data
 * @returns {Promise<string>} - The generated geo lead ID
 */
export async function addGeoLead(sql, psc, service, source, geo = {}) {
  const id = crypto.randomUUID();
  const PSC_MAP = {
    '397': 'Písek', '386': 'Strakonice', '399': 'Milevsko',
    '389': 'Vodňany', '398': 'Protivín', '388': 'Blatná',
  };
  const prefix = psc ? psc.substring(0, 3) : null;
  const city = prefix ? (PSC_MAP[prefix] || 'Jiné') : null;

  const cityFromEdge = typeof geo.city === 'string' && geo.city.trim() ? geo.city.trim() : null;
  const cityResolved = city || cityFromEdge;
  const latitude = Number.isFinite(geo.latitude) ? geo.latitude : null;
  const longitude = Number.isFinite(geo.longitude) ? geo.longitude : null;
  const h3HexagonId = typeof geo.h3HexagonId === 'string' && geo.h3HexagonId ? geo.h3HexagonId : null;
  const countryCode = typeof geo.countryCode === 'string' && geo.countryCode ? geo.countryCode : null;

  try {
    await sql`
      INSERT INTO geo_leads (id, psc, city, service, source, latitude, longitude, h3_hexagon_id, country_code)
      VALUES (${id}, ${psc}, ${cityResolved}, ${service}, ${source}, ${latitude}, ${longitude}, ${h3HexagonId}, ${countryCode})
    `;
  } catch (err) {
    const msg = String(err && err.message ? err.message : '');
    const isMissingNewGeoColumn = msg.includes('latitude') || msg.includes('longitude');
    if (!isMissingNewGeoColumn) {
      throw err;
    }

    await sql`
      INSERT INTO geo_leads (id, psc, city, service, source) 
      VALUES (${id}, ${psc}, ${cityResolved}, ${service}, ${source})
    `;
  }

  return id;
}

/**
 * Subscribes email to newsletter with encryption and dedup.
 * @param {import('@neondatabase/serverless').NeonQueryFunction<any, any>} sql
 * @param {DataCrypt} crypt - Initialized DataCrypt instance
 * @param {string} email - Email address to subscribe
 * @param {string} [source='form'] - Subscription source
 * @returns {Promise<string>} - The subscriber ID (existing or new)
 */
export async function subscribeNewsletter(sql, crypt, email, source = 'form') {
  const emailHash = await DataCrypt.hash(email.toLowerCase().trim());

  const [existing] = await sql`SELECT id, status FROM newsletter_subscribers WHERE email_hash = ${emailHash}`;

  if (existing) {
    if (existing.status === 'unsubscribed') {
      await sql`UPDATE newsletter_subscribers SET status = 'active' WHERE id = ${existing.id}`;
    }
    return existing.id;
  }

  const id = crypto.randomUUID();
  const emailEnc = await crypt.encrypt(email);
  await sql`
    INSERT INTO newsletter_subscribers (id, email_enc, email_hash, source) 
    VALUES (${id}, ${emailEnc}, ${emailHash}, ${source})
  `;

  return id;
}
