// POST /api/calendar-hook
// Google Calendar webhook receiver.
// Processes calendar event changes: confirms bookings, sends emails,
// schedules SMS reminders.

import { DataCrypt } from '../lib/datacrypt.js';
import { ResendConnector } from '../lib/connectors/resend.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Webhook-Secret',
};

// Google Calendar color IDs → operator mapping
// Colors: 1=lavender, 2=sage, 3=grape, 4=flamingo, 5=banana(yellow/pending),
//         6=tangerine, 7=peacock, 8=graphite, 9=blueberry, 10=basil, 11=tomato(green/confirmed)
const COLOR_TO_STATUS = {
  '5': 'pending',    // yellow = pending
  '10': 'confirmed', // basil/green = confirmed
  '11': 'cancelled', // tomato/red = cancelled
};

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/calendar-hook — Google Calendar webhook receiver. Implementuje echo suppression
 * (3 vrstvy: KV dedup 24h + guard status!=newStatus + gate confirmation_sent_at IS NULL).
 * Mapuje event barvu na status: '5'=pending, '10'=confirmed, '11'=cancelled.
 * Jen reálné přechody spouští e-mail (gated), přeuspořádávání a SMS remindery.
 *
 * @param {Request} request - HTTP POST s X-Webhook-Secret headerem a JSON payloadem.
 * @param {object} env - Cloudflare Worker bindings (DB, CACHE, SECRET_CALENDAR_WEBHOOK_SECRET).
 * @returns {Response} JSON { success: true/false } (200 OK i u dedup/no-op, 401 na nevalidní secret).
 */
export async function onRequestPost({ request, env }) {
  try {
    // 1. Verify webhook secret
    const webhookSecret = request.headers.get('X-Webhook-Secret');
    if (!webhookSecret || webhookSecret !== env.SECRET_CALENDAR_WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // 2. Parse Google Calendar webhook payload
    let payload;
    try {
      payload = await request.json();
    } catch {
      // Google sometimes sends empty notification pings (sync messages)
      return new Response(
        JSON.stringify({ success: true, message: 'Sync acknowledged' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const { resourceId, eventId, colorId, calendarId } = payload;

    if (!resourceId || !eventId) {
      return new Response(
        JSON.stringify({ success: true, message: 'No actionable event' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 3. Dedup via KV — skip already-processed events
    const dedupKey = `evt:${resourceId}:${eventId}`;
    const alreadyProcessed = await env.CACHE.get(dedupKey);
    if (alreadyProcessed) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already processed' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 4. Identify operator from calendar ID
    const operator = await env.DB.prepare(
      'SELECT id, name FROM operators WHERE calendar_id = ? AND active = 1'
    ).bind(calendarId || '').first();

    // 5. Determine new status from event color
    const newStatus = COLOR_TO_STATUS[colorId] || null;

    if (!newStatus || newStatus === 'pending') {
      // No status change needed, just mark as processed
      await env.CACHE.put(dedupKey, '1', { expirationTtl: 86400 });
      return new Response(
        JSON.stringify({ success: true, message: 'No status change' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 6. Find and update booking by calendar event ID
    const booking = await env.DB.prepare(
      'SELECT id, email_enc, name_enc, phone_enc, service, preferred_date, slot_start, status, confirmation_sent_at FROM bookings WHERE calendar_event_id = ?'
    ).bind(eventId).first();

    if (!booking) {
      await env.CACHE.put(dedupKey, '1', { expirationTtl: 86400 });
      return new Response(
        JSON.stringify({ success: true, message: 'No matching booking' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // G2: Update booking status (guard: jen když se status mění)
    const updateResult = await env.DB.prepare(
      'UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP, operator_id = COALESCE(?, operator_id) WHERE id = ? AND status != ?'
    ).bind(newStatus, operator?.id || null, booking.id, newStatus).run();

    const changes = updateResult?.meta?.changes || 0;
    if (changes === 0) {
      // Stav se nemění — skip e-mail a jiné efekty
      await env.CACHE.put(dedupKey, '1', { expirationTtl: 86400 });
      return new Response(
        JSON.stringify({ success: true, message: 'No state change' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 7. G2: If confirmed, send confirmation email (gated) and schedule SMS reminder
    if (newStatus === 'confirmed' && booking.email_enc) {
      try {
        const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
        const [email, name, phone] = await Promise.all([
          crypt.decrypt(booking.email_enc),
          booking.name_enc ? crypt.decrypt(booking.name_enc) : 'Klient',
          booking.phone_enc ? crypt.decrypt(booking.phone_enc) : null,
        ]);

        // G2: Gate: send email only if confirmation_sent_at IS NULL (first time)
        const shouldSendEmail = !booking.confirmation_sent_at;
        if (shouldSendEmail) {
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

          // NÁLEZ #3: Send confirmation email, set confirmation_sent_at JEN když e-mail uspěje
          const resend = new ResendConnector(env);
          const sendResult = await resend.sendBookingConfirmation({
            name,
            email,
            service: booking.service,
            date: dateStr,
            time: timeStr,
          });

          // Mark email sent — jen pokud e-mail vrátil non-null
          if (sendResult) {
            await env.DB.prepare(
              'UPDATE bookings SET confirmation_sent_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(booking.id).run();
          } else {
            console.warn('[calendar-hook] Confirmation email not sent (null response); confirmation_sent_at not updated');
          }
        }

        // 8. Schedule SMS reminder (T-24h before appointment)
        if (phone) {
          const reminderTime = new Date(booking.preferred_date);
          reminderTime.setHours(reminderTime.getHours() - 24);

          // Only schedule if reminder time is in the future
          if (reminderTime > new Date()) {
            await env.DB.prepare(
              `INSERT INTO reminders (id, booking_id, channel, send_at)
               VALUES (?, ?, 'sms', ?)`
            ).bind(crypto.randomUUID(), booking.id, reminderTime.toISOString()).run();
          }
        }
      } catch (err) {
        console.error('[calendar-hook] Email/SMS scheduling error:', err);
        // Continue — don't fail the webhook for email errors
      }
    }

    // Audit log
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'bookings', ?, 'update', 'calendar-webhook', ?)`
    ).bind(
      crypto.randomUUID(),
      booking.id,
      `Status changed to ${newStatus} via calendar webhook (operator: ${operator?.name || 'unknown'})`
    ).run();

    // 9. Mark event as processed in KV (24h TTL)
    await env.CACHE.put(dedupKey, '1', { expirationTtl: 86400 });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[calendar-hook] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
