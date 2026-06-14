// Queue consumer: booking-jobs
// Triggered when a new booking is created via /api/book.
// Performs async tasks: Google Calendar insert, confirmation email,
// Telegram notification, SMS reminder scheduling.

import { DataCrypt } from '../lib/datacrypt.js';
import { GoogleCalendarConnector } from '../lib/connectors/google-calendar.js';
import { TelegramConnector } from '../lib/connectors/telegram.js';
import { ResendConnector } from '../lib/connectors/resend.js';

/**
 * Queue consumer for booking-jobs.
 * Each message contains the booking data (already saved to D1).
 * @param {MessageBatch} batch - Batch of queue messages
 * @param {Object} env - Environment bindings
 */
export default {
  async queue(batch, env) {
    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    const calendar = new GoogleCalendarConnector(env);
    const telegram = new TelegramConnector(env);
    const resend = new ResendConnector(env);

    for (const message of batch.messages) {
      try {
        const booking = message.body;

        // 1. Insert event into Google Calendar (yellow = pending)
        // F6: Použij přesný čas (slot_start/end) pokud je dostupný, jinak default (preferred_date +60min)
        const calendarStart = booking.slot_start || booking.preferred_date;
        const calendarEnd = booking.slot_end ? booking.slot_end : addMinutes(booking.preferred_date, 60);

        const calendarEvent = await calendar.insertEvent({
          summary: `Bicom Písek — ${booking.service}`,
          description: [
            `Klient: ${booking.name}`,
            `E-mail: ${booking.email}`,
            `Telefon: ${booking.phone}`,
            booking.note ? `Poznámka: ${booking.note}` : '',
            `Cena (odhad): ${booking.estimated_price || '—'} Kč`,
          ].filter(Boolean).join('\n'),
          start: {
            dateTime: calendarStart,
            timeZone: 'Europe/Prague',
          },
          end: {
            dateTime: calendarEnd,
            timeZone: 'Europe/Prague',
          },
          colorId: '5', // yellow = pending
        });

        // 2. Update booking with calendar event ID (if insert succeeded)
        if (calendarEvent?.id) {
          await env.DB.prepare(
            'UPDATE bookings SET calendar_event_id = ? WHERE id = ?'
          ).bind(calendarEvent.id, booking.bookingId).run();
        }

        // F6: Použij slot_start pokud je dostupný (přesný čas), jinak preferred_date
        const displayDateTime = booking.slot_start || booking.preferred_date;
        const dateObj = new Date(displayDateTime);
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

        // 3. Send confirmation email to client
        await resend.sendBookingConfirmation({
          name: booking.name,
          email: booking.email,
          service: booking.service,
          date: dateStr,
          time: timeStr,
          estimatedPrice: booking.estimated_price,
        });

        // 4. Notify operators via Telegram
        await telegram.sendBookingNotification({
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          service: booking.service,
          preferred_date: dateStr,
          estimated_price: booking.estimated_price,
          note: booking.note,
        });

        // 5. Schedule reminders (T-24h)
        const reminderTime = addMinutes(booking.preferred_date, -24 * 60);
        const reminderChannel = booking.reminder_channel || 'email';

        // Email reminder is always scheduled (core channel)
        await env.DB.prepare(
          `INSERT INTO reminders (id, booking_id, channel, send_at)
           VALUES (?, ?, 'email', ?)`
        ).bind(crypto.randomUUID(), booking.bookingId, reminderTime).run();

        // Secondary reminder channel based on client's preference
        if (reminderChannel === 'sms') {
          await env.DB.prepare(
            `INSERT INTO reminders (id, booking_id, channel, send_at)
             VALUES (?, ?, 'sms', ?)`
          ).bind(crypto.randomUUID(), booking.bookingId, reminderTime).run();
        } else if (reminderChannel === 'whatsapp') {
          console.warn(`[queue-booking] WhatsApp upomínka pro rezervaci ${booking.bookingId} přeskočena – dispatcher zatím WhatsApp neodesílá.`);
        }

        // 7. Audit log
        await env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'bookings', ?, 'update', 'system', 'Async processing complete: calendar + email + telegram + reminders')`
        ).bind(crypto.randomUUID(), booking.bookingId).run();

        message.ack();
      } catch (err) {
        console.error(`[queue-booking] Error processing booking ${message.body?.bookingId}:`, err);
        message.retry({ delaySeconds: 30 });
      }
    }
  },
};

/**
 * Adds minutes to an ISO datetime string.
 * @param {string} isoDate - ISO 8601 datetime
 * @param {number} minutes - Minutes to add (negative = subtract)
 * @returns {string} New ISO datetime string
 */
function addMinutes(isoDate, minutes) {
  const d = new Date(isoDate);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
