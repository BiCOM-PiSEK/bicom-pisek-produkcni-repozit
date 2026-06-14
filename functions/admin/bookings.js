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

/**
 * GET /admin/bookings — seznam všech rezervací s filtrací dle statusu.
 * PII (jméno, email, telefon) se automaticky dešifrují. Vyžaduje oprávnění operátora.
 *
 * @param {object} env - Cloudflare Worker bindings (DB, SECRET_ENCRYPTION_KEY).
 * @param {object} data - Context data s operátor info.
 * @param {Request} request - HTTP request (params: status, limit, offset).
 * @returns {Response} JSON { ok, data: { bookings[], total } } nebo { ok: false, error }.
 */
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

/**
 * PUT /admin/bookings — aktualizace statusu a přiřazení operátora.
 * G2 potvrzení (pending→confirmed): guarded (no-op když není pending), e-mail gated
 * (confirmation_sent_at IS NULL — jen jednou), Google event přebarven na '10' (Basil/zelená),
 * assigned_to uložen. Konfirmace e-mailu je nutná před persistence confirmation_sent_at (retry-safe).
 *
 * @param {object} env - Cloudflare Worker bindings (DB, SECRET_ENCRYPTION_KEY, SECRET_GOOGLE_CALENDAR_*).
 * @param {object} data - Context data s operátor info.
 * @param {Request} request - HTTP request s JSON body: { id, status, assigned_to? }.
 * @returns {Response} JSON { ok, data: { id, status, confirmed_at?, assigned_to? } } nebo { ok: false, error }.
 */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const body = await request.json();

    const bookingId = body.id || url.searchParams.get('id');
    if (!bookingId) return json({ ok: false, error: 'Chybí ID rezervace.' }, 400);

    // G3: Nejdřív zkontroluj, zda je to PŘESUN TERMÍNU
    const newSlotStart = body.new_slot_start;
    const newSlotEnd = body.new_slot_end;

    // NÁLEZ #3: jeden bez druhého = neúplný přesun → chyba PŘED isReschedule
    if ((newSlotStart && !newSlotEnd) || (!newSlotStart && newSlotEnd)) {
      return json({ ok: false, error: 'Pro přesun je nutný začátek i konec slotu.' }, 400);
    }

    // Obrácený nebo neplatný rozsah → 400 (konec musí být po začátku)
    if (newSlotStart && newSlotEnd) {
      const startMs = Date.parse(newSlotStart);
      const endMs = Date.parse(newSlotEnd);
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return json({ ok: false, error: 'Konec slotu musí být po jeho začátku.' }, 400);
      }
    }

    const isReschedule = !!(newSlotStart && newSlotEnd);

    if (isReschedule) {

      // Načti booking pro informace o stavu a Google kalendariu
      const booking = await env.DB.prepare(
        `SELECT id, calendar_event_id, email_enc, name_enc, service, status, slot_start, preferred_date
         FROM bookings WHERE id = ?`
      ).bind(bookingId).first();

      // NÁLEZ #2: guard na neexistující rezervaci
      if (!booking) {
        return json({ ok: false, error: 'Rezervace nenalezena.' }, 404);
      }

      // Přesun povol jen pro pending/confirmed
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return json({ ok: false, error: 'Přesunout lze jen čekající nebo potvrzenou rezervaci.' }, 409);
      }

      // NÁLEZ #1: UPDATE + audit_log v JEDNOM batchi (governance pravidlo)
      // UNIQUE kolizní detekce obal CELÝ batch do try/catch
      try {
        await env.DB.batch([
          env.DB.prepare(
            'UPDATE bookings SET slot_start = ?, slot_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind(newSlotStart, newSlotEnd, bookingId),
          env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'bookings', ?, 'reschedule', ?, ?)`
          ).bind(
            crypto.randomUUID(),
            bookingId,
            `operator:${data.operator.id}`,
            `Slot: ${booking.slot_start || 'none'} → ${newSlotStart}`
          ),
        ]);

        // Side effects: Google Calendar + e-mail (mimo batch)
        const calendar = new GoogleCalendarConnector(env);
        const resend = new ResendConnector(env);

        // Změní čas Google eventu (bez 'Z')
        if (booking.calendar_event_id) {
          calendar.updateEventTime(booking.calendar_event_id, newSlotStart, newSlotEnd)
            .catch((err) => console.warn(`[admin/bookings] Google time update failed: ${err.message}`));
        }

        // Pošli e-mail o přesunu
        if (booking.email_enc) {
          try {
            const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
            const [email, name] = await Promise.all([
              crypt.decrypt(booking.email_enc),
              booking.name_enc ? crypt.decrypt(booking.name_enc) : 'Klient',
            ]);

            const displayDateTime = newSlotStart;
            const dateObj = new Date(displayDateTime.includes('T') ? displayDateTime : displayDateTime.replace(' ', 'T') + ':00');
            const dateStr = new Intl.DateTimeFormat('cs-CZ', {
              timeZone: 'Europe/Prague',
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
            }).format(dateObj);
            const timeStr = new Intl.DateTimeFormat('cs-CZ', {
              timeZone: 'Europe/Prague',
              hour: '2-digit',
              minute: '2-digit',
            }).format(dateObj);

            const sendResult = await resend.sendBookingRescheduled({
              name,
              email,
              service: booking.service,
              date: dateStr,
              time: timeStr,
            });

            if (!sendResult) {
              console.warn(`[admin/bookings] Reschedule email not sent (null response)`);
            }
          } catch (err) {
            console.warn(`[admin/bookings] Reschedule email failed: ${err.message}`);
          }
        }

        return json({ ok: true, data: { id: bookingId, slot_start: newSlotStart, slot_end: newSlotEnd } });
      } catch (dbErr) {
        // Kolizní detekce — UNIQUE index na slot_start
        const msg = String(dbErr?.message || '');
        const isSlotCollision = msg.includes('UNIQUE') &&
          (msg.includes('idx_bookings_slot_unique') || msg.includes('slot_start'));
        if (isSlotCollision) {
          return json({ ok: false, error: 'Tento čas je již obsazen. Vyberte prosím jiný slot.' }, 409);
        }
        throw dbErr;
      }
    }

    // Status změna (G2 logika — bez přesunu)
    const newStatus = body.status;
    if (newStatus && !['confirmed', 'cancelled', 'done', 'pending'].includes(newStatus)) {
      return json({ ok: false, error: 'Neplatný status.' }, 400);
    }

    // NÁLEZ #1: rozliš "pole nebylo v requestu" od "pole je prázdné"
    const hasAssignedTo = Object.prototype.hasOwnProperty.call(body, 'assigned_to');
    const assignedToRaw = hasAssignedTo ? body.assigned_to : undefined;
    const assignedTo = assignedToRaw === null || assignedToRaw === '' ? null : (assignedToRaw ? String(assignedToRaw).trim() : undefined);

    // Validuj jen když bylo pole zadáno a není null/prázdné string
    if (hasAssignedTo && assignedTo !== undefined && assignedTo !== null && !['Jana', 'Tereza'].includes(assignedTo)) {
      return json({ ok: false, error: 'Neplatná volba operátora. Povoleno: Jana, Tereza, nebo prázdné.' }, 400);
    }

    // Pokud není status, vrať chybu
    if (!newStatus) {
      return json({ ok: false, error: 'Chybí status nebo slot pro přesun.' }, 400);
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

      // NÁLEZ #2: batch WITHOUT confirmation_sent_at — jen status + assigned_to + audit_log
      // confirmation_sent_at se vyplní AŽ PO úspěšném e-mailu
      const updateOps = [
        env.DB.prepare(
          `UPDATE bookings SET updated_at = CURRENT_TIMESTAMP${hasAssignedTo ? ', assigned_to = ?' : ''}
           WHERE id = ?`
        ),
      ];
      const updateBindings = [];
      if (hasAssignedTo) updateBindings.push(assignedTo);
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
          `Status → confirmed${hasAssignedTo && assignedTo ? `, assigned_to=${assignedTo}` : ''}`
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

      // NÁLEZ #2: e-mail POD podmínkou: jen pokud jsem popup (confirmation_sent_at IS NULL)
      // Až POTÉ co e-mail uspěje, vyplním confirmation_sent_at
      let confirmationSentAt = null;
      if (!booking.confirmation_sent_at && booking.email_enc) {
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

          const sendResult = await resend.sendBookingConfirmation({
            name,
            email,
            service: booking.service,
            date: dateStr,
            time: timeStr,
          });

          // Jen pokud e-mail uspěl, vyplň confirmation_sent_at
          if (sendResult) {
            confirmationSentAt = getNowInPrague().toISOString();
            await env.DB.prepare(
              'UPDATE bookings SET confirmation_sent_at = ? WHERE id = ?'
            ).bind(confirmationSentAt, bookingId).run();
          } else {
            console.warn(`[admin/bookings] Email not sent (null response); confirmation_sent_at not updated`);
          }
        } catch (err) {
          console.warn(`[admin/bookings] Email send failed: ${err.message}`);
        }
      }

      return json({ ok: true, data: { id: bookingId, status: newStatus, confirmed_at: confirmationSentAt, assigned_to: assignedTo } });
    }

    // G4: Zrušení (měkké) — cancelled
    if (newStatus === 'cancelled') {
      // Načti booking data pro efekty (ale rozhodnutí řiď podle UPDATE guard)
      const booking = await env.DB.prepare(
        `SELECT id, calendar_event_id, email_enc, name_enc, service, preferred_date, slot_start, cancellation_notified_at
         FROM bookings WHERE id = ?`
      ).bind(bookingId).first();

      if (!booking) {
        return json({ ok: false, error: 'Rezervace nenalezena.' }, 404);
      }

      // NÁLEZ #1: Guard PŘÍMO v UPDATE, rozhodn efekty podle changes
      const notifyClient = body.notify_client === true;
      const updateOps = [
        env.DB.prepare(
          `UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP${hasAssignedTo ? ', assigned_to = ?' : ''}
           WHERE id = ? AND status IN ('pending','confirmed')`
        ),
      ];
      const updateBindings = [newStatus];
      if (hasAssignedTo) updateBindings.push(assignedTo);
      updateBindings.push(bookingId);
      updateOps[0] = updateOps[0].bind(...updateBindings);

      // Audit detail — neutrální text
      updateOps.push(
        env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'bookings', ?, 'cancel', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          bookingId,
          `operator:${data.operator.id}`,
          'Zrušeno operátorem'
        )
      );

      const batchResults = await env.DB.batch(updateOps);
      const changes = batchResults?.[0]?.meta?.changes || 0;

      // Efekty JEN když se status opravdu změnil (souběh guard)
      if (changes === 0) {
        return json({ ok: true, message: 'Žádná změna (rezervace již není pending nebo confirmed)' });
      }

      // Side effects: Google + e-mail (mimo batch)
      const calendar = new GoogleCalendarConnector(env);
      const resend = new ResendConnector(env);

      // Přebarvi Google na '11' (Tomato/červená)
      if (booking.calendar_event_id) {
        calendar.updateEventColor(booking.calendar_event_id, '11')
          .catch((err) => console.warn(`[admin/bookings] Google cancel color update failed: ${err.message}`));
      }

      // Informuj klienta (gate: cancellation_notified_at IS NULL)
      if (notifyClient && !booking.cancellation_notified_at && booking.email_enc) {
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

          const sendResult = await resend.sendBookingCancelled({
            name,
            email,
            service: booking.service,
            date: dateStr,
          });

          if (sendResult) {
            // Jen když e-mail uspěl, vyplň cancellation_notified_at
            await env.DB.prepare(
              'UPDATE bookings SET cancellation_notified_at = ? WHERE id = ?'
            ).bind(getNowInPrague().toISOString(), bookingId).run();
          } else {
            console.warn(`[admin/bookings] Cancellation email not sent (null response)`);
          }
        } catch (err) {
          console.warn(`[admin/bookings] Cancellation email failed: ${err.message}`);
        }
      }

      return json({ ok: true, data: { id: bookingId, status: newStatus, assigned_to: assignedTo } });
    }

    // Pro ostatní statusy: zachovej jednoduché chování (ale s hasAssignedTo guard)
    const updateOps = [
      env.DB.prepare(
        `UPDATE bookings SET status = ?${hasAssignedTo ? ', assigned_to = ?' : ''} WHERE id = ?`
      ),
    ];
    const updateBindings = [newStatus];
    if (hasAssignedTo) updateBindings.push(assignedTo);
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
        `Status → ${newStatus}${hasAssignedTo && assignedTo ? `, assigned_to=${assignedTo}` : ''}`
      )
    );

    await env.DB.batch(updateOps);
    return json({ ok: true, data: { id: bookingId, status: newStatus, assigned_to: assignedTo } });
  } catch (err) {
    console.error('[admin/bookings] PUT error:', err);
    return json({ ok: false, error: 'Chyba při aktualizaci.' }, 500);
  }
}

/**
 * DELETE /admin/bookings — tvrdé smazání (NEVRATNÉ).
 * Pojistka: vyžaduje confirm=true. Audit zapsán PŘED výmazem řádku (audit_log přežije).
 *
 * @param {object} env - Cloudflare Worker bindings (DB, SECRET_GOOGLE_CALENDAR_*).
 * @param {object} data - Context data s operátor info.
 * @param {Request} request - HTTP request (query: ?id=...&confirm=true).
 * @returns {Response} JSON { ok, data: { id, deleted:true } } nebo { ok: false, error }.
 */
export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body nemusí být JSON pro DELETE
    }

    const bookingId = body.id || url.searchParams.get('id');
    if (!bookingId) return json({ ok: false, error: 'Chybí ID rezervace.' }, 400);

    // POJISTKA: vyžaduj explicitní potvrzení
    const confirm = body.confirm === true || url.searchParams.get('confirm') === 'true';
    if (!confirm) {
      return json({ ok: false, error: 'Smazání vyžaduje potvrzení (confirm=true).' }, 400);
    }

    // Načti booking
    const booking = await env.DB.prepare(
      'SELECT id, calendar_event_id FROM bookings WHERE id = ?'
    ).bind(bookingId).first();

    if (!booking) {
      return json({ ok: false, error: 'Rezervace nenalezena.' }, 404);
    }

    // G4: Tvrdé smazání — AUDIT FIRST pořadí
    // NÁLEZ #3: Audit text musí být realistický (záznam akce, ne tvrzení o dokončení)
    // 1) Zapiš audit log PRVNÍ (DŘÍVE než DELETE) — ať přežije i při selhání
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'bookings', ?, 'delete', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      bookingId,
      `operator:${data.operator.id}`,
      'Požadavek na tvrdé smazání operátorem'
    ).run();

    // 2) Smaž Google událost
    if (booking.calendar_event_id) {
      const calendar = new GoogleCalendarConnector(env);
      const deleted = await calendar.deleteEvent(booking.calendar_event_id);
      if (!deleted) {
        console.warn(`[admin/bookings] Google delete event failed for ${booking.calendar_event_id}; proceeding with DB delete`);
      }
    }

    // 3) Fyzicky smaž řádek (teď)
    await env.DB.prepare(
      'DELETE FROM bookings WHERE id = ?'
    ).bind(bookingId).run();

    return json({ ok: true, data: { id: bookingId, deleted: true } });
  } catch (err) {
    console.error('[admin/bookings] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při smazání.' }, 500);
  }
}
