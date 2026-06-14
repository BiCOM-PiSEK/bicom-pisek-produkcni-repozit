/**
 * BICOM PÍSEK — Bookings Admin API
 * GET  /admin/bookings — seznam s filtrací
 * PUT  /admin/bookings — aktualizace (s :id v query)
 */
import { DataCrypt } from '../lib/datacrypt.js';
import { GoogleCalendarConnector } from '../lib/connectors/google-calendar.js';
import { ResendConnector } from '../lib/connectors/resend.js';
import { getNowInPrague } from '../api/availability.js';

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

    const bookingId = body.id || url.searchParams.get('id');
    if (!bookingId) return json({ ok: false, error: 'Chybí ID rezervace.' }, 400);

    const newStatus = body.status;
    if (!['confirmed', 'cancelled', 'done', 'pending'].includes(newStatus)) {
      return json({ ok: false, error: 'Neplatný status.' }, 400);
    }

    // Validate assigned_to (opcional, přípustné: Jana, Tereza, null/empty)
    const assignedTo = body.assigned_to ? body.assigned_to.trim() : null;
    if (assignedTo && !['Jana', 'Tereza'].includes(assignedTo)) {
      return json({ ok: false, error: 'Neplatná volba operátora. Povoleno: Jana, Tereza, nebo prázdné.' }, 400);
    }

    // G2: Pro 'confirmed' — guard + full workflow (e-mail, Google, assigned_to)
    if (newStatus === 'confirmed') {
      // Guard: změňuj jen pending → confirmed
      const updateResult = await env.DB.prepare(
        'UPDATE bookings SET status = ? WHERE id = ? AND status = ?'
      ).bind(newStatus, bookingId, 'pending').run();

      // Pokud se nic nezměnilo, vrať bez efektů
      const changes = updateResult?.meta?.changes || 0;
      if (changes === 0) {
        return json({ ok: true, message: 'Žádná změna (status není pending)' });
      }

      // Načti booking detaily pro e-mail a Google
      const booking = await env.DB.prepare(
        `SELECT id, calendar_event_id, email_enc, name_enc, service, preferred_date, slot_start, confirmation_sent_at
         FROM bookings WHERE id = ?`
      ).bind(bookingId).first();

      // Batch: confirmation_sent_at + assigned_to + audit_log
      const nowPrague = getNowInPrague().toISOString();
      const confirmationSentAt = booking.confirmation_sent_at ? null : nowPrague;

      const updateOps = [
        env.DB.prepare(
          `UPDATE bookings SET updated_at = CURRENT_TIMESTAMP${confirmationSentAt ? ', confirmation_sent_at = ?' : ''}${assignedTo !== undefined ? ', assigned_to = ?' : ''}
           WHERE id = ?`
        ),
      ];
      const updateBindings = [];
      if (confirmationSentAt) updateBindings.push(confirmationSentAt);
      if (assignedTo !== undefined) updateBindings.push(assignedTo);
      updateBindings.push(bookingId);
      updateOps[0] = updateOps[0].bind(...updateBindings);

      updateOps.push(
        env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'bookings', ?, 'update', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          bookingId,
          `operator:${data.operator.id}`,
          `Status → confirmed${confirmationSentAt ? ' (e-mail sent)' : ''}${assignedTo ? `, assigned_to=${assignedTo}` : ''}`
        )
      );

      await env.DB.batch(updateOps);

      // Side effects: Google Calendar + Email (mimo batch)
      const calendar = new GoogleCalendarConnector(env);
      const resend = new ResendConnector(env);

      // Přebarvi Google event na zeleno (confirmed)
      if (booking.calendar_event_id) {
        calendar.updateEventColor(booking.calendar_event_id, '10')
          .catch((err) => console.warn(`[admin/bookings] Google color update failed: ${err.message}`));
      }

      // Pošli e-mail pokud jsme právě nastavili confirmation_sent_at (tj. poprvé)
      if (confirmationSentAt && booking.email_enc) {
        try {
          const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
          const [email, name] = await Promise.all([
            crypt.decrypt(booking.email_enc),
            booking.name_enc ? crypt.decrypt(booking.name_enc) : 'Klient',
          ]);

          const displayDateTime = booking.slot_start || booking.preferred_date;
          const dateObj = new Date(displayDateTime.includes('T') ? displayDateTime : displayDateTime.replace(' ', 'T') + ':00');
          const dateStr = new Intl.DateTimeFormat('cs-CZ', {
            timeZone: 'Europe/Prague',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
          }).format(dateObj);
          const timeStr = booking.slot_start
            ? new Intl.DateTimeFormat('cs-CZ', {
                timeZone: 'Europe/Prague',
                hour: '2-digit',
                minute: '2-digit',
              }).format(dateObj)
            : null;

          await resend.sendBookingConfirmation({
            name,
            email,
            service: booking.service,
            date: dateStr,
            time: timeStr,
          });
        } catch (err) {
          console.warn(`[admin/bookings] Email send failed: ${err.message}`);
        }
      }

      return json({ ok: true, data: { id: bookingId, status: newStatus, confirmed_at: confirmationSentAt, assigned_to: assignedTo } });
    }

    // Pro ostatní statusy: zachovej jednoduché chování
    const updateOps = [
      env.DB.prepare(
        `UPDATE bookings SET status = ?${assignedTo !== undefined ? ', assigned_to = ?' : ''} WHERE id = ?`
      ),
    ];
    const updateBindings = [newStatus];
    if (assignedTo !== undefined) updateBindings.push(assignedTo);
    updateBindings.push(bookingId);
    updateOps[0] = updateOps[0].bind(...updateBindings);

    updateOps.push(
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'bookings', ?, 'update', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        bookingId,
        `operator:${data.operator.id}`,
        `Status → ${newStatus}${assignedTo ? `, assigned_to=${assignedTo}` : ''}`
      )
    );

    await env.DB.batch(updateOps);
    return json({ ok: true, data: { id: bookingId, status: newStatus, assigned_to: assignedTo } });
  } catch (err) {
    console.error('[admin/bookings] PUT error:', err);
    return json({ ok: false, error: 'Chyba při aktualizaci.' }, 500);
  }
}
