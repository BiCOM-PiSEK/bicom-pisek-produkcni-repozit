/**
 * BICOM PÍSEK — Booking Detail API
 * GET /admin/booking-detail — detaily rezervace s dešifrovanými PII a audit historií
 */
import { DataCrypt } from '../lib/datacrypt.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * GET /admin/booking-detail — detail rezervace s historií.
 * Vrátí dešifrovaná PII (bez _enc polí) + audit_log historii.
 *
 * @param {object} env - Cloudflare Worker bindings (DB, SECRET_ENCRYPTION_KEY).
 * @param {object} data - Context data s operátor info.
 * @param {Request} request - HTTP request (query: ?id=...).
 * @returns {Response} JSON { ok, data: { booking, history } } nebo { ok: false, error }.
 */
export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const bookingId = url.searchParams.get('id');
    if (!bookingId) return json({ ok: false, error: 'Chybí ID rezervace.' }, 400);

    // Načti rezervaci
    const booking = await env.DB.prepare(
      'SELECT * FROM bookings WHERE id = ?'
    ).bind(bookingId).first();

    if (!booking) {
      return json({ ok: false, error: 'Rezervace nenalezena.' }, 404);
    }

    // NÁLEZ #1a: Guard na SECRET_ENCRYPTION_KEY
    if (!env.SECRET_ENCRYPTION_KEY) {
      console.warn('[booking-detail] SECRET_ENCRYPTION_KEY not configured');
      return json({ ok: false, error: 'Šifrování není nakonfigurováno.' }, 500);
    }

    // Dešifruj PII
    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    let decrypted = { ...booking };
    try {
      const [name, email, phone, note] = await Promise.all([
        booking.name_enc ? crypt.decrypt(booking.name_enc) : null,
        booking.email_enc ? crypt.decrypt(booking.email_enc) : null,
        booking.phone_enc ? crypt.decrypt(booking.phone_enc) : null,
        booking.note_enc ? crypt.decrypt(booking.note_enc) : null,
      ]);
      decrypted = {
        ...decrypted,
        name,
        email,
        phone,
        note,
      };
    } catch (err) {
      console.warn('[booking-detail] Decryption error:', err);
      decrypted.name = '(chyba dešifrování)';
    }

    // NÁLEZ #1b: VŽDY odstraň _enc pole (i při chybě dešifrování) — ochrana PII
    delete decrypted.name_enc;
    delete decrypted.email_enc;
    delete decrypted.phone_enc;
    delete decrypted.note_enc;

    // NÁLEZ #4: Načti audit historii + LIMIT 100
    const history = await env.DB.prepare(
      `SELECT id, action, actor, details, created_at
       FROM audit_log
       WHERE entity = 'bookings' AND entity_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(bookingId).all();

    const historyItems = (history?.results || []).map((row) => ({
      action: row.action,
      actor: row.actor,
      details: row.details,
      created_at: row.created_at,
    }));

    return json({ ok: true, data: { booking: decrypted, history: historyItems } });
  } catch (err) {
    console.error('[booking-detail] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání detailů.' }, 500);
  }
}
