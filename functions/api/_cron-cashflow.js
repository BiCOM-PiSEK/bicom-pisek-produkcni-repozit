// Cron: Cash flow monitoring (weekly, Monday 09:00)
// Schedule: 0 9 * * 1
// Compares this week's bookings and revenue with the previous week.
// Sends alert to Telegram if there's a significant change.

import { TelegramConnector } from '../lib/connectors/telegram.js';

export default {
  async scheduled(event, env, ctx) {
    const config = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'cashflow_alerts'"
    ).first();
    if (config?.value !== 'active') return;

    const telegram = new TelegramConnector(env);
    const now = new Date();

    // This week (Mon-Sun)
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    thisWeekStart.setHours(0, 0, 0, 0);

    // Last week
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    // Query this week's stats
    const thisWeek = await env.DB.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(estimated_price), 0) as revenue
       FROM bookings
       WHERE created_at >= ? AND created_at < ?`
    ).bind(thisWeekStart.toISOString(), now.toISOString()).first();

    // Query last week's stats
    const lastWeek = await env.DB.prepare(
      `SELECT COUNT(*) as count, COALESCE(SUM(estimated_price), 0) as revenue
       FROM bookings
       WHERE created_at >= ? AND created_at < ?`
    ).bind(lastWeekStart.toISOString(), thisWeekStart.toISOString()).first();

    // Pending bookings
    const pending = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'`
    ).first();

    // Top service this week
    const topService = await env.DB.prepare(
      `SELECT service, COUNT(*) as count
       FROM bookings
       WHERE created_at >= ?
       GROUP BY service
       ORDER BY count DESC
       LIMIT 1`
    ).bind(thisWeekStart.toISOString()).first();

    // Calculate trend
    const prevCount = lastWeek?.count || 0;
    const currCount = thisWeek?.count || 0;
    const changePercent = prevCount > 0
      ? Math.round(((currCount - prevCount) / prevCount) * 100)
      : (currCount > 0 ? 100 : 0);

    const trendEmoji = changePercent > 0 ? '📈' : changePercent < 0 ? '📉' : '➡️';

    await telegram.sendCashFlowAlert({
      bookings_count: currCount,
      revenue: thisWeek?.revenue || 0,
      prev_bookings_count: prevCount,
      prev_revenue: lastWeek?.revenue || 0,
      change: changePercent,
      pending_count: pending?.count || 0,
      top_service: topService?.service || '—',
      trend_emoji: trendEmoji,
    });

    console.log(`[cron-cashflow] Report sent: ${currCount} bookings this week (${changePercent}% vs last week)`);
  },
};
