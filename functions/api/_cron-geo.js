// Cron: GEO analytics aggregation (weekly, Monday 04:00)
// Schedule: 0 4 * * 1
// Aggregates geo_leads into recommendations for admin + Telegram digest.

import { TelegramConnector } from '../lib/connectors/telegram.js';

export default {
  async scheduled(event, env, ctx) {
    const telegram = new TelegramConnector(env);

    // Aggregate geo leads from last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { results: cityStats } = await env.DB.prepare(
      `SELECT city, COUNT(*) as count, GROUP_CONCAT(DISTINCT service) as services
       FROM geo_leads
       WHERE created_at >= ? AND city IS NOT NULL
       GROUP BY city
       ORDER BY count DESC
       LIMIT 10`
    ).bind(weekAgo.toISOString()).all();

    const { results: serviceStats } = await env.DB.prepare(
      `SELECT service, COUNT(*) as count
       FROM geo_leads
       WHERE created_at >= ?
       GROUP BY service
       ORDER BY count DESC
       LIMIT 5`
    ).bind(weekAgo.toISOString()).all();

    if (!cityStats?.length && !serviceStats?.length) return;

    // Build Telegram digest
    let message = '📍 <b>GEO Týdenní Report</b>\n\n';

    if (cityStats?.length) {
      message += '<b>Města (odkud přicházejí poptávky):</b>\n';
      for (const stat of cityStats) {
        message += `  • ${stat.city}: ${stat.count}× (${stat.services})\n`;
      }
      message += '\n';
    }

    if (serviceStats?.length) {
      message += '<b>Nejžádanější služby:</b>\n';
      for (const stat of serviceStats) {
        message += `  • ${stat.service}: ${stat.count}×\n`;
      }
      message += '\n';
    }

    // Smart recommendations
    if (cityStats?.length && cityStats[0].count >= 5) {
      message += `💡 <b>Doporučení:</b> Nárůst poptávek z ${cityStats[0].city} (${cityStats[0].count}× za týden). Zvažte lokální kampaň.\n`;
    }

    await telegram.sendMessage(message);

    console.log(`[cron-geo] GEO report sent: ${cityStats?.length || 0} cities, ${serviceStats?.length || 0} services`);
  },
};
