// functions/api/_cron-worker.js
// Cloudflare Worker Cron Router
// Routes cron events to the respective daily/weekly background tasks.

import cronBackup from './_cron-backup.js';
import cronCashflow from './_cron-cashflow.js';
import cronGdpr from './_cron-gdpr.js';
import cronGeo from './_cron-geo.js';
import cronInstagram from './_cron-instagram.js';
import cronReminders from './_cron-reminders.js';
import cronSocial from './_cron-social.js';

export default {
  async scheduled(event, env, ctx) {
    console.log(`[cron-worker] Triggered by schedule: ${event.cron}`);

    switch (event.cron) {
      // 1. reminders-dispatch (every hour)
      case "0 */1 * * *":
      case "0 * * * *":
        ctx.waitUntil(cronReminders.scheduled(event, env, ctx));
        break;

      // 2. instagram-sync (daily at 03:00)
      case "0 3 * * *":
        ctx.waitUntil(cronInstagram.scheduled(event, env, ctx));
        break;

      // 3. gdpr-anonymize (daily at 03:30)
      case "30 3 * * *":
        ctx.waitUntil(cronGdpr.scheduled(event, env, ctx));
        break;

      // 4. geo-insights (weekly on Mondays at 04:00)
      case "0 4 * * MON":
      case "0 4 * * 1": // Standard UNIX Monday (0=SUN, 1=MON)
      case "0 4 * * 2": // Cloudflare Monday (1=SUN, 2=MON)
        ctx.waitUntil(cronGeo.scheduled(event, env, ctx));
        break;

      // 5. d1-backup (weekly on Sundays at 02:00)
      case "0 2 * * SUN":
      case "0 2 * * 0": // Standard UNIX Sunday
      case "0 2 * * 7": // Standard UNIX Sunday (alternative)
      case "0 2 * * 1": // Cloudflare Sunday (1=SUN, 2=MON)
        ctx.waitUntil(cronBackup.scheduled(event, env, ctx));
        break;

      // 6. social-publish (daily at 08:00)
      case "0 8 * * *":
        ctx.waitUntil(cronSocial.scheduled(event, env, ctx));
        break;

      // 7. cashflow-alerts (weekly on Mondays at 09:00)
      case "0 9 * * MON":
      case "0 9 * * 1": // Standard UNIX Monday
      case "0 9 * * 2": // Cloudflare Monday
        ctx.waitUntil(cronCashflow.scheduled(event, env, ctx));
        break;

      default:
        console.warn(`[cron-worker] No handler registered for schedule: ${event.cron}`);
    }
  }
};
