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
import cronBlogPublish from './_cron-blog-publish.js';

export default {
  async scheduled(event, env, ctx) {
    console.log(`[cron-worker] Triggered by schedule: ${event.cron}`);

    // Parsujeme minutu a hodinu z cron výrazu (první dvě pole oddělená mezerami)
    const parts = (event.cron || "").trim().split(/\s+/);
    if (parts.length < 2) {
      console.error(`[cron-worker] Neplatný cron řetězec: ${event.cron}`);
      return;
    }

    const minuta = parts[0];
    const hodina = parts[1];

    // Zjištění aktuálního dne v časovém pásmu Europe/Prague (např. 'Sun', 'Mon'...)
    const den = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Europe/Prague'
    }).format(new Date());

    // Rozhodování na základě minuty a hodiny (unikátní kombinace pro každou z 7 úloh)
    // 1. Reminders & Blog Auto-Publish (každou hodinu - hodina obsahuje '*' nebo '*/1')
    if (minuta === '0' && (hodina === '*' || hodina === '*/1')) {
      console.log(`[cron-worker] Spouštím reminders-dispatch a blog-auto-publish`);
      ctx.waitUntil(cronReminders.scheduled(event, env, ctx));
      ctx.waitUntil(cronBlogPublish.scheduled(event, env, ctx));
    }
    // 2. Backup (neděle 02:00)
    else if (minuta === '0' && hodina === '2') {
      if (den === 'Sun') {
        console.log(`[cron-worker] Spouštím d1-backup (ověřeno: je neděle v Europe/Prague)`);
        ctx.waitUntil(cronBackup.scheduled(event, env, ctx));
      } else {
        console.log(`[cron-worker] Přeskakuji d1-backup (dnes je ${den}, očekává se Sun)`);
      }
    }
    // 3. Instagram Sync (denně 03:00)
    else if (minuta === '0' && hodina === '3') {
      console.log(`[cron-worker] Spouštím instagram-sync`);
      ctx.waitUntil(cronInstagram.scheduled(event, env, ctx));
    }
    // 4. GDPR Anonymize (denně 03:30)
    else if (minuta === '30' && hodina === '3') {
      console.log(`[cron-worker] Spouštím gdpr-anonymize`);
      ctx.waitUntil(cronGdpr.scheduled(event, env, ctx));
    }
    // 5. Geo Insights (pondělí 04:00)
    else if (minuta === '0' && hodina === '4') {
      if (den === 'Mon') {
        console.log(`[cron-worker] Spouštím geo-insights (ověřeno: je pondělí v Europe/Prague)`);
        ctx.waitUntil(cronGeo.scheduled(event, env, ctx));
      } else {
        console.log(`[cron-worker] Přeskakuji geo-insights (dnes je ${den}, očekává se Mon)`);
      }
    }
    // 6. Social Publish (denně 08:00)
    else if (minuta === '0' && hodina === '8') {
      console.log(`[cron-worker] Spouštím social-publish`);
      ctx.waitUntil(cronSocial.scheduled(event, env, ctx));
    }
    // 7. Cashflow Alerts (pondělí 09:00)
    else if (minuta === '0' && hodina === '9') {
      if (den === 'Mon') {
        console.log(`[cron-worker] Spouštím cashflow-alerts (ověřeno: je pondělí v Europe/Prague)`);
        ctx.waitUntil(cronCashflow.scheduled(event, env, ctx));
      } else {
        console.log(`[cron-worker] Přeskakuji cashflow-alerts (dnes je ${den}, očekává se Mon)`);
      }
    }
    else {
      console.warn(`[cron-worker] Nebyl nalezen žádný handler pro minutu "${minuta}" a hodinu "${hodina}" (cron: ${event.cron})`);
    }
  }
};
