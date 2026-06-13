/**
 * BICOM PÍSEK — Bookings Admin API
 * GET  /admin/bookings — seznam s filtrací
 * PUT  /admin/bookings — aktualizace (s :id v query)
 */
import { DataCrypt } from '../lib/datacrypt.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = 'SELECT * FROM bookings';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await env.DB.prepare(query).bind(...params).all();

    let countQuery = 'SELECT COUNT(*) as total FROM bookings';
    const countParams = [];
    if (status) { countQuery += ' WHERE status = ?'; countParams.push(status); }
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

    // Decrypt PII
    let bookings = result?.results || [];
    if (env.SECRET_ENCRYPTION_KEY && bookings.length > 0) {
      const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
      bookings = await Promise.all(bookings.map(async (b) => {
        try {
          const [name, email, phone, note] = await Promise.all([
            crypt.decrypt(b.name_enc),
            crypt.decrypt(b.email_enc),
            crypt.decrypt(b.phone_enc),
            b.note_enc ? crypt.decrypt(b.note_enc) : null,
          ]);
          return { ...b, name, email, phone, note, name_enc: undefined, email_enc: undefined, phone_enc: undefined, note_enc: undefined };
        } catch { return { ...b, name: '(chyba dešifrování)' }; }
      }));
    }

    return json({ ok: true, data: { bookings, total: countResult?.total || 0 } });
  } catch (err) {
    console.error('[admin/bookings] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání.' }, 500);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const body = await request.json();

    // Booking ID from body or query param
    const bookingId = body.id || url.searchParams.get('id');
    if (!bookingId) return json({ ok: false, error: 'Chybí ID rezervace.' }, 400);

    const newStatus = body.status;
    if (!['confirmed', 'cancelled', 'done', 'pending'].includes(newStatus)) {
      return json({ ok: false, error: 'Neplatný status.' }, 400);
    }

    await env.DB.batch([
      env.DB.prepare('UPDATE bookings SET status = ? WHERE id = ?').bind(newStatus, bookingId),
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'bookings', ?, 'update', ?, ?)`
      ).bind(crypto.randomUUID(), bookingId, `operator:${data.operator.id}`, `Status → ${newStatus}`),
    ]);

    return json({ ok: true, data: { id: bookingId, status: newStatus } });
  } catch (err) {
    console.error('[admin/bookings] PUT error:', err);
    return json({ ok: false, error: 'Chyba při aktualizaci.' }, 500);
  }
}
