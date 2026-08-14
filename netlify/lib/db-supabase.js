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
 * Zaznamená událost do audit_log tabulky v Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} entity
 * @param {string} entityId
 * @param {string} action
 * @param {string} actor
 * @param {string} details
 */
export async function recordAuditLog(supabase, entity, entityId, action, actor, details) {
  try {
    await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      entity,
      entity_id: entityId,
      action,
      actor,
      details,
    });
  } catch (err) {
    console.error('[audit_log] Chyba při zápisu do audit_log:', err);
  }
}

/**
 * Vytvoří novou rezervaci v Supabase s šifrovanými osobními údaji.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {DataCrypt} crypt
 * @param {Object} data
 * @returns {Promise<string>} ID vytvořené rezervace
 */
export async function createBooking(supabase, crypt, data) {
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

  const { error: insertError } = await supabase.from('bookings').insert({
    id,
    name_enc: nameEnc,
    email_enc: emailEnc,
    phone_enc: phoneEnc,
    service: data.service,
    note_enc: noteEnc,
    preferred_date: data.preferred_date,
    psc,
    estimated_price: estimatedPrice,
    consent_version: consentVersion,
    consent_marketing: consentMarketing,
    reminder_channel: reminderChannel,
    email_hash: emailHash,
    status: 'pending',
  });

  if (insertError) {
    throw new Error(`[db-supabase] createBooking failed: ${insertError.message}`);
  }

  await recordAuditLog(supabase, 'bookings', id, 'create', 'system', 'Nová rezervace vytvořena z webu');

  return id;
}

/**
 * Potvrdí rezervaci v Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bookingId
 * @param {string} operatorId
 */
export async function confirmBooking(supabase, bookingId, operatorId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', bookingId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(`[db-supabase] confirmBooking failed: ${error.message}`);
  }

  await recordAuditLog(supabase, 'bookings', bookingId, 'update', `operator:${operatorId}`, 'Stav změněn na confirmed');
}

/**
 * Zruší rezervaci v Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} bookingId
 * @param {string} reason
 * @param {string} operatorId
 */
export async function cancelBooking(supabase, bookingId, reason, operatorId) {
  const { error } = await supabase
    .from('bookings')
    .update({ 
      status: 'cancelled',
      cancellation_reason: reason || null,
    })
    .eq('id', bookingId);

  if (error) {
    throw new Error(`[db-supabase] cancelBooking failed: ${error.message}`);
  }

  await recordAuditLog(supabase, 'bookings', bookingId, 'cancel', `operator:${operatorId}`, `Rezervace zrušena: ${reason || 'bez udání důvodu'}`);
}

/**
 * Načte a dešifruje záznam rezervace.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {DataCrypt} crypt
 * @param {string} bookingId
 * @returns {Promise<Object|null>}
 */
export async function getDecryptedBooking(supabase, crypt, bookingId) {
  const { data: row, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error || !row) return null;

  const [name, email, phone, note] = await Promise.all([
    crypt.decrypt(row.name_enc),
    crypt.decrypt(row.email_enc),
    crypt.decrypt(row.phone_enc),
    row.note_enc ? crypt.decrypt(row.note_enc) : Promise.resolve(null),
  ]);

  return {
    ...row,
    name,
    email,
    phone,
    note,
  };
}

/**
 * Vytvoří nebo aktualizuje geo_lead v Supabase.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Object} data
 * @returns {Promise<string>}
 */
export async function createGeoLead(supabase, data) {
  const id = crypto.randomUUID();
  const psc = (data.psc || '').replace(/\s+/g, '');
  const city = data.city || null;
  const service = data.service || null;
  const source = data.source || 'booking';

  const { error } = await supabase.from('geo_leads').insert({
    id,
    psc,
    city,
    service,
    source,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    h3_hexagon_id: data.h3_hexagon_id || null,
    country_code: data.country_code || 'CZ',
  });

  if (error) {
    console.error('[db-supabase] createGeoLead warning:', error.message);
  }

  return id;
}

/**
 * Přihlásí e-mail k odběru newsletteru.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {DataCrypt} crypt
 * @param {string} email
 * @param {string} [source='form']
 * @returns {Promise<string>}
 */
export async function subscribeNewsletter(supabase, crypt, email, source = 'form') {
  const normalizedEmail = email.toLowerCase().trim();
  const emailHash = await DataCrypt.keyedHash(normalizedEmail, crypt.oldestKeyHex);

  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email_hash', emailHash)
    .single();

  if (existing) {
    if (existing.status === 'unsubscribed') {
      await supabase
        .from('newsletter_subscribers')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  const id = crypto.randomUUID();
  const emailEnc = await crypt.encrypt(email);

  const { error } = await supabase.from('newsletter_subscribers').insert({
    id,
    email_enc: emailEnc,
    email_hash: emailHash,
    source,
    status: 'active',
  });

  if (error) {
    throw new Error(`[db-supabase] subscribeNewsletter failed: ${error.message}`);
  }

  return id;
}

/**
 * Odhlásí e-mail z odběru newsletteru.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {DataCrypt} crypt
 * @param {string} email
 */
export async function unsubscribeNewsletter(supabase, crypt, email) {
  const normalizedEmail = email.toLowerCase().trim();
  const emailHash = await DataCrypt.keyedHash(normalizedEmail, crypt.oldestKeyHex);

  await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('email_hash', emailHash);
}

/**
 * Načte seznam aktivních služeb z databáze (s řazením podle sort_order).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Array>}
 */
export async function getServices(supabase) {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[db-supabase] getServices error:', error);
    return [];
  }

  return data || [];
}

/**
 * Načte obsah Hero sekce pro web.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<Object|null>}
 */
export async function getHeroContent(supabase) {
  const { data, error } = await supabase
    .from('hero_content')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}

/**
 * Načte fotky z galerie.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} [category]
 * @returns {Promise<Array>}
 */
export async function getGalleryPhotos(supabase, category = null) {
  let query = supabase
    .from('gallery_photos')
    .select('*')
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[db-supabase] getGalleryPhotos error:', error);
    return [];
  }

  return data || [];
}
