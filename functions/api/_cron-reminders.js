// Cron: Send SMS and email reminders (every hour)
// Schedule: 0 */1 * * *
// Checks for unsent reminders where send_at <= now.

import { DataCrypt } from '../lib/datacrypt.js';
import { ResendConnector } from '../lib/connectors/resend.js';
import { GoSmsConnector } from '../lib/connectors/gosms.js';

export default {
  async scheduled(event, env, ctx) {
    // Check if reminders are enabled (new keys + backward-compatible legacy key)
    const configRows = await env.DB.prepare(
      "SELECT key, value FROM process_states WHERE key IN ('reminder_sms', 'reminder_email', 'booking_sms_reminder')"
    ).all();
    const configMap = new Map((configRows?.results || []).map((row) => [row.key, row.value]));
    const legacySmsEnabled = configMap.get('booking_sms_reminder') === 'active';
    const smsEnabled = configMap.has('reminder_sms')
      ? configMap.get('reminder_sms') === '1'
      : legacySmsEnabled;
    const emailEnabled = configMap.has('reminder_email')
      ? configMap.get('reminder_email') === '1'
      : true;
    if (!smsEnabled && !emailEnabled) return;

    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    const resend = new ResendConnector(env);
    const gosms = new GoSmsConnector(env);
    const now = new Date().toISOString();

    // Get unsent reminders that are due
    const { results: reminders } = await env.DB.prepare(
      `SELECT r.*, b.name_enc, b.email_enc, b.phone_enc, b.service, b.preferred_date
       FROM reminders r
       JOIN bookings b ON r.booking_id = b.id
       WHERE r.sent = 0 AND r.send_at <= ?
       AND b.status IN ('pending', 'confirmed')
       LIMIT 50`
    ).bind(now).all();

    if (!reminders?.length) return;

    let sentCount = 0;

    for (const reminder of reminders) {
      try {
        // Decrypt contact data
        const [name, email, phone] = await Promise.all([
          crypt.decrypt(reminder.name_enc),
          crypt.decrypt(reminder.email_enc),
          crypt.decrypt(reminder.phone_enc),
        ]);

        const dateObj = new Date(reminder.preferred_date);

        // Format date part only (e.g., "10. 6. 2026")
        const dateStr = new Intl.DateTimeFormat('cs-CZ', {
          timeZone: 'Europe/Prague',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        }).format(dateObj);

        const booking = {
          name,
          email,
          phone,
          service: reminder.service,
          preferredDate: reminder.preferred_date,
          date: dateStr,
        };

        if (reminder.channel === 'sms' && smsEnabled) {
          await gosms.sendBookingReminder(booking);
        } else if (reminder.channel === 'email' && emailEnabled) {
          await resend.sendBookingReminder(booking);
        } else {
          continue;
        }

        // Mark as sent
        await env.DB.prepare(
          'UPDATE reminders SET sent = 1 WHERE id = ?'
        ).bind(reminder.id).run();

        sentCount++;
      } catch (err) {
        console.error(`[cron-reminders] Failed to send reminder ${reminder.id}:`, err);
      }
    }

    console.log(`[cron-reminders] Sent ${sentCount}/${reminders.length} reminders`);
  },
};
