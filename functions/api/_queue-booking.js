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
            dateTime: booking.preferred_date,
            timeZone: 'Europe/Prague',
          },
          end: {
            // Default session = 60 min
            dateTime: addMinutes(booking.preferred_date, 60),
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

        // 3. Send confirmation email to client
        await resend.sendBookingConfirmation({
          name: booking.name,
          email: booking.email,
          service: booking.service,
          preferredDate: booking.preferred_date,
          estimatedPrice: booking.estimated_price,
        });

        // 4. Notify operators via Telegram
        await telegram.sendBookingNotification({
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          service: booking.service,
          preferredDate: booking.preferred_date,
          estimatedPrice: booking.estimated_price,
          note: booking.note,
        });

        // 5. Schedule SMS reminder (T-24h)
        const reminderTime = addMinutes(booking.preferred_date, -24 * 60);
        await env.DB.prepare(
          `INSERT INTO reminders (id, booking_id, channel, send_at)
           VALUES (?, ?, 'sms', ?)`
        ).bind(crypto.randomUUID(), booking.bookingId, reminderTime).run();

        // 6. Schedule email reminder (T-24h)
        await env.DB.prepare(
          `INSERT INTO reminders (id, booking_id, channel, send_at)
           VALUES (?, ?, 'email', ?)`
        ).bind(crypto.randomUUID(), booking.bookingId, reminderTime).run();

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
