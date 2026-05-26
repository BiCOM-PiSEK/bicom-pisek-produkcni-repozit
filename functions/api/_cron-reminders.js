// Cron: Send SMS and email reminders (every hour)
// Schedule: 0 */1 * * *
// Checks for unsent reminders where send_at <= now.

import { DataCrypt } from '../lib/datacrypt.js';
import { ResendConnector } from '../lib/connectors/resend.js';
import { GoSmsConnector } from '../lib/connectors/gosms.js';

export default {
  async scheduled(event, env, ctx) {
    // Check if reminders are enabled
    const config = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'booking_sms_reminder'"
    ).first();
    if (config?.value !== 'active') return;

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

        const booking = {
          name,
          email,
          phone,
          service: reminder.service,
          preferredDate: reminder.preferred_date,
        };

        if (reminder.channel === 'sms') {
          await gosms.sendBookingReminder(booking);
        } else if (reminder.channel === 'email') {
          await resend.sendBookingReminder(booking);
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
