// Queue consumer: booking-jobs
// Triggered when a new booking is created via /api/book.
// Performs async tasks: Google Calendar insert, confirmation email,
// Telegram notification, SMS reminder scheduling.

import { DataCrypt } from '../lib/datacrypt.js';
import { getDecryptedBooking } from '../lib/db.js';
import { GoogleCalendarConnector } from '../lib/connectors/google-calendar.js';
import { TelegramConnector } from '../lib/connectors/telegram.js';
import { ResendConnector } from '../lib/connectors/resend.js';

/**
 * Convert "YYYY-MM-DD HH:MM" to RFC 3339 with "T" and seconds (Calendar API requirement).
 * Already ISO-formatted strings (with "T") pass through unchanged.
 */
function toRfc3339(dateTimeStr) {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') return dateTimeStr;
  // Already ISO with 'T' (from toISOString) → keep as is
  if (dateTimeStr.includes('T')) return dateTimeStr;
  // "YYYY-MM-DD HH:MM" → "YYYY-MM-DDTHH:MM:00"
  return dateTimeStr.replace(' ', 'T') + ':00';
}

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
        const job = message.body;

        // Fetch raw columns first to allow duplicate check without decryption
        const rawBooking = await env.DB.prepare(
          'SELECT calendar_event_id, name_enc, email_enc, phone_enc, note_enc, service, preferred_date, slot_start, slot_end, estimated_price, reminder_channel FROM bookings WHERE id = ?'
        ).bind(job.bookingId).first();

        if (!rawBooking) {
          console.error(`[queue-booking] Booking ${job.bookingId} not found in DB.`);
          message.ack();
          continue;
        }

        if (rawBooking.calendar_event_id) {
          console.info(`[queue-booking] Booking ${job.bookingId} already processed, skipping duplicate message.`);
          message.ack();
          continue;
        }

        // Decrypt PII fields only for messages that will be processed
        const [name, email, phone, note] = await Promise.all([
          crypt.decrypt(rawBooking.name_enc),
          crypt.decrypt(rawBooking.email_enc),
          crypt.decrypt(rawBooking.phone_enc),
          rawBooking.note_enc ? crypt.decrypt(rawBooking.note_enc) : Promise.resolve(null),
        ]);

        const booking = {
          ...rawBooking,
          id: job.bookingId,
          name,
          email,
          phone,
          note,
        };

        // 1. Insert event into Google Calendar (yellow = pending)
        // Rozlišit: slot (přesný čas) vs. bez slotu (celodenní)
        // Bug fix: bez slotu se preferred_date (ISO s 'Z'/UTC) posílal jako dateTime → 2:00 ráno
        // Řešení: slot=dateTime+timeZone (lokální), bez slotu=all-day (jen date)
        const eventData = {
          summary: `Bicom Písek — ${booking.service}`,
          description: [
            `Klient: ${booking.name}`,
            `E-mail: ${booking.email}`,
            `Telefon: ${booking.phone}`,
            booking.note ? `Poznámka: ${booking.note}` : '',
            `Cena (odhad): ${booking.estimated_price || '—'} Kč`,
          ].filter(Boolean).join('\n'),
          colorId: '5', // yellow = pending
        };

        if (booking.slot_start) {
          // Slotová rezervace: přesný čas s timeZone
          let calendarEnd = booking.slot_end;
          if (!calendarEnd) {
            // Fallback: slot_start + 60 min jako LOKÁLNÍ string (bez Z)
            const [d, t] = booking.slot_start.split(' ');
            const [y, mo, da] = d.split('-').map(Number);
            const [h, mi] = t.split(':').map(Number);
            const endLocal = new Date(y, mo - 1, da, h, mi + 60, 0, 0);
            const p = (n) => String(n).padStart(2, '0');
            calendarEnd = `${endLocal.getFullYear()}-${p(endLocal.getMonth() + 1)}-${p(endLocal.getDate())} ${p(endLocal.getHours())}:${p(endLocal.getMinutes())}`;
          }
          eventData.start = {
            dateTime: toRfc3339(booking.slot_start),
            timeZone: 'Europe/Prague',
          };
          eventData.end = {
            dateTime: toRfc3339(calendarEnd),
            timeZone: 'Europe/Prague',
          };
        } else {
          // Neslotová rezervace: celodenní (all-day) event
          // preferred_date je ISO "2026-06-20T00:00:00.000Z" → vezmi prvních 10 znaků
          const startDate = booking.preferred_date.slice(0, 10);
          // end.date je EXKLUZIVNÍ → musí být +1 den
          const endDateObj = new Date(startDate + 'T00:00:00Z');
          endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
          const endDate = endDateObj.toISOString().slice(0, 10);
          eventData.start = { date: startDate };
          eventData.end = { date: endDate };
        }

        const calendarEvent = await calendar.insertEvent(eventData);

        // 2. Update booking with calendar event ID (if insert succeeded)
        if (calendarEvent?.id) {
          await env.DB.prepare(
            'UPDATE bookings SET calendar_event_id = ? WHERE id = ?'
          ).bind(calendarEvent.id, booking.id).run();
        }

        // F6: Použij slot_start pokud je dostupný (přesný čas), jinak preferred_date
        // #3 displayDateTime: parsuj spolehlivě přes toRfc3339 helper
        const displayDateTime = booking.slot_start || booking.preferred_date;
        const dateObj = new Date(toRfc3339(displayDateTime));
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
        // #4 reminderTime: z reálného času schůzky (slot_start), ne z preferred_date
        const reminderBase = booking.slot_start || booking.preferred_date;
        const reminderTime = addMinutes(toRfc3339(reminderBase), -24 * 60);
        const reminderChannel = booking.reminder_channel || 'email';

        // Email reminder is always scheduled (core channel)
        await env.DB.prepare(
          `INSERT INTO reminders (id, booking_id, channel, send_at)
           VALUES (?, ?, 'email', ?)`
        ).bind(crypto.randomUUID(), booking.id, reminderTime).run();

        // Secondary reminder channel based on client's preference
        if (reminderChannel === 'sms') {
          await env.DB.prepare(
            `INSERT INTO reminders (id, booking_id, channel, send_at)
             VALUES (?, ?, 'sms', ?)`
          ).bind(crypto.randomUUID(), booking.id, reminderTime).run();
        } else if (reminderChannel === 'whatsapp') {
          console.warn(`[queue-booking] WhatsApp upomínka pro rezervaci ${booking.id} přeskočena – dispatcher zatím WhatsApp neodesílá.`);
        }

        // 7. Audit log
        await env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'bookings', ?, 'update', 'system', 'Async processing complete: calendar + email + telegram + reminders')`
        ).bind(crypto.randomUUID(), booking.id).run();

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
