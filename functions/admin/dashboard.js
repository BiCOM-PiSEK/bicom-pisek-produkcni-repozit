/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Dashboard API
 * ═══════════════════════════════════════════════════════════════
 * GET /admin/dashboard
 *
 * Vrací souhrnné statistiky pro Virtual Office dashboard:
 *   - Pending bookings count + this-week trend
 *   - Confirmed bookings this month
 *   - Revenue (from iDoklad or estimated from bookings)
 *   - AI articles in draft
 *   - Recent pending bookings (top 5, decrypted)
 *   - Top GEO cities
 *   - System health status
 * ═══════════════════════════════════════════════════════════════
 */

import { DataCrypt } from '../lib/datacrypt.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestGet({ env, data }) {
  const operator = data.operator;
  if (!operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const db = env.DB;
    const now = new Date();

    // ─── Parallel queries for speed ──────────────────────
    const [
      pendingResult,
      pendingWeekResult,
      pendingLastWeekResult,
      confirmedResult,
      confirmedLastMonthResult,
      recentBookingsResult,
      topCitiesResult,
      aiArticlesResult,
    ] = await Promise.all([
      // 1. Pending bookings count (current)
      db.prepare(
        "SELECT COUNT(*) as cnt FROM bookings WHERE status = 'pending'"
      ).first(),

      // 2. Pending this week
      db.prepare(
        `SELECT COUNT(*) as cnt FROM bookings
         WHERE status = 'pending'
         AND created_at >= date('now', 'weekday 0', '-7 days')`
      ).first(),

      // 3. Pending last week (for trend)
      db.prepare(
        `SELECT COUNT(*) as cnt FROM bookings
         WHERE status = 'pending'
         AND created_at >= date('now', 'weekday 0', '-14 days')
         AND created_at < date('now', 'weekday 0', '-7 days')`
      ).first(),

      // 4. Confirmed this month
      db.prepare(
        `SELECT COUNT(*) as cnt FROM bookings
         WHERE status IN ('confirmed', 'done')
         AND created_at >= date('now', 'start of month')`
      ).first(),

      // 5. Confirmed last month (for trend)
      db.prepare(
        `SELECT COUNT(*) as cnt FROM bookings
         WHERE status IN ('confirmed', 'done')
         AND created_at >= date('now', 'start of month', '-1 month')
         AND created_at < date('now', 'start of month')`
      ).first(),

      // 6. Recent pending bookings (top 5)
      db.prepare(
        `SELECT id, name_enc, service, preferred_date, status, created_at
         FROM bookings
         WHERE status = 'pending'
         ORDER BY created_at DESC
         LIMIT 5`
      ).all(),

      // 7. Top GEO cities
      db.prepare(
        `SELECT psc, COUNT(*) as count
         FROM geo_leads
         GROUP BY psc
         ORDER BY count DESC
         LIMIT 5`
      ).all(),

      // 8. AI articles in draft
      db.prepare(
        "SELECT COUNT(*) as cnt FROM blog_posts WHERE status = 'draft'"
      ).first(),
    ]);

    // ─── Decrypt recent bookings ─────────────────────────
    let recentBookings = [];
    if (recentBookingsResult?.results?.length > 0 && env.SECRET_ENCRYPTION_KEY) {
      const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
      recentBookings = await Promise.all(
        recentBookingsResult.results.map(async (b) => {
          let name = '(šifrováno)';
          try {
            name = await crypt.decrypt(b.name_enc);
          } catch { /* fallback */ }
          return {
            id: b.id,
            name,
            service: b.service,
            preferred_date: b.preferred_date,
            status: b.status,
            created_at: b.created_at,
          };
        })
      );
    } else if (recentBookingsResult?.results) {
      recentBookings = recentBookingsResult.results.map((b) => ({
        ...b,
        name: '(šifrováno — klíč nedostupný)',
      }));
    }

    // ─── GEO: PSČ → město mapování ──────────────────────
    const pscToCity = {
      '39701': 'Písek', '39703': 'Písek',
      '38601': 'Strakonice', '38901': 'Vodňany',
      '39811': 'Protivín', '39901': 'Milevsko',
      '37001': 'České Budějovice', '37501': 'Týn nad Vltavou',
      '38701': 'Volyně', '38801': 'Blatná',
    };

    const topCities = (topCitiesResult?.results || []).map((row) => ({
      name: pscToCity[row.psc] || `PSČ ${row.psc}`,
      count: row.count,
      psc: row.psc,
    }));

    // ─── Trend calculations ──────────────────────────────
    const pendingThisWeek = pendingWeekResult?.cnt || 0;
    const pendingLastWeek = pendingLastWeekResult?.cnt || 0;
    const pendingTrend = pendingLastWeek > 0
      ? Math.round(((pendingThisWeek - pendingLastWeek) / pendingLastWeek) * 100)
      : 0;

    const confirmedThisMonth = confirmedResult?.cnt || 0;
    const confirmedLastMonth = confirmedLastMonthResult?.cnt || 0;
    const confirmedTrend = confirmedLastMonth > 0
      ? Math.round(((confirmedThisMonth - confirmedLastMonth) / confirmedLastMonth) * 100)
      : 0;

    // ─── Revenue calculation (actual Stripe payments + fallback to estimated) ──
    let revenueWeek = 0;
    let revenueToday = 0;
    let hasStripeTransactions = false;
    try {
      const txCheck = await db.prepare("SELECT COUNT(*) as cnt FROM payment_transactions").first();
      if (txCheck?.cnt > 0) {
        hasStripeTransactions = true;
        const revWeekResult = await db.prepare(
          `SELECT SUM(amount) as total
           FROM payment_transactions
           WHERE status = 'completed'
           AND created_at >= date('now', 'weekday 0', '-7 days')`
        ).first();
        revenueWeek = revWeekResult?.total || 0;

        const revTodayResult = await db.prepare(
          `SELECT SUM(amount) as total
           FROM payment_transactions
           WHERE status = 'completed'
           AND date(created_at) = date('now')`
        ).first();
        revenueToday = revTodayResult?.total || 0;
      }
    } catch { /* Table might not exist yet or empty */ }

    if (!hasStripeTransactions) {
      try {
        const revWeekResult = await db.prepare(
          `SELECT SUM(COALESCE(estimated_price, 0)) as total
           FROM bookings
           WHERE status IN ('confirmed', 'done')
           AND created_at >= date('now', 'weekday 0', '-7 days')`
        ).first();
        revenueWeek = revWeekResult?.total || 0;

        const revTodayResult = await db.prepare(
          `SELECT SUM(COALESCE(estimated_price, 0)) as total
           FROM bookings
           WHERE status IN ('confirmed', 'done')
           AND date(created_at) = date('now')`
        ).first();
        revenueToday = revTodayResult?.total || 0;
      } catch { /* estimation fallback */ }
    }

    // ─── Launch blockers readiness (L1/L5/L8/L9) ────────
    const launchBlockers = {
      L1: {
        label: 'Resend (produkční odesílání e-mailů)',
        ready: Boolean(env.RESEND_API_KEY || env.SECRET_RESEND_API_KEY),
      },
      L5: {
        label: 'GoSMS (SMS upomínky + kredit)',
        ready: Boolean(env.SECRET_SMS_GATEWAY_CLIENT_ID && env.SECRET_SMS_GATEWAY_CLIENT_SECRET),
      },
      L8: {
        label: 'Stripe (live key + webhook secret)',
        ready: Boolean(env.SECRET_STRIPE_SECRET_KEY && env.SECRET_STRIPE_WEBHOOK_SECRET),
      },
      L9: {
        label: 'iDoklad (produkční OAuth klíče)',
        ready: Boolean(env.SECRET_IDOKLAD_CLIENT_ID && env.SECRET_IDOKLAD_CLIENT_SECRET),
      },
    };
    const launchBlockersSummary = {
      total: Object.keys(launchBlockers).length,
      ready: Object.values(launchBlockers).filter((item) => item.ready).length,
      blocked: Object.values(launchBlockers).filter((item) => !item.ready).length,
    };

    // ─── System health ───────────────────────────────────
    const system = {
      d1: 'ok', // we just queried it successfully
      r2: env.MEDIA ? 'ok' : 'standby',
      kv: env.CACHE ? 'ok' : 'standby',
      telegram: env.SECRET_TELEGRAM_BOT_TOKEN ? 'ok' : 'standby',
      calendar: env.SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL ? 'ok' : 'standby',
      resend: (env.RESEND_API_KEY || env.SECRET_RESEND_API_KEY) ? 'ok' : 'standby',
      gosms: (env.SECRET_SMS_GATEWAY_CLIENT_ID && env.SECRET_SMS_GATEWAY_CLIENT_SECRET) ? 'ok' : 'standby',
      idoklad: (env.SECRET_IDOKLAD_CLIENT_ID && env.SECRET_IDOKLAD_CLIENT_SECRET) ? 'ok' : 'standby',
      stripe: env.SECRET_STRIPE_SECRET_KEY ? 'ok' : 'standby',
      stripeWebhook: env.SECRET_STRIPE_WEBHOOK_SECRET ? 'ok' : 'standby',
    };

    // ─── Response ────────────────────────────────────────
    return json({
      ok: true,
      data: {
        pendingBookings: pendingResult?.cnt || 0,
        pendingTrend,
        confirmedBookings: confirmedThisMonth,
        confirmedTrend,
        revenueWeek,
        revenueTrend: 0, // TODO: calculate once iDoklad connected
        revenueToday,
        aiArticles: aiArticlesResult?.cnt || 0,
        aiTrend: 0,
        recentBookings,
        topCities,
        system,
        launchBlockers,
        launchBlockersSummary,
        operator: {
          name: operator.name,
          role: operator.role,
        },
      },
    });
  } catch (err) {
    console.error('[admin/dashboard] Error:', err);
    return json({ ok: false, error: 'Interní chyba při načítání přehledu.' }, 500);
  }
}
