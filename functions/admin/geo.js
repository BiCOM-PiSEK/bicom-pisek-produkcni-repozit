/**
 * BICOM PÍSEK — GEO Analytics Admin API
 * GET /admin/geo — statistiky dle regionu
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const PSC_TO_CITY = {
  '39701': 'Písek', '39703': 'Písek', '39704': 'Písek',
  '38601': 'Strakonice', '38901': 'Vodňany',
  '39811': 'Protivín', '39901': 'Milevsko',
  '37001': 'České Budějovice', '37501': 'Týn nad Vltavou',
  '38701': 'Volyně', '38801': 'Blatná',
};

export async function onRequestGet({ env, data }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    // Aggregate by city
    const cityResult = await env.DB.prepare(
      `SELECT city, COUNT(*) as count
       FROM geo_leads
       WHERE city IS NOT NULL
       GROUP BY city
       ORDER BY count DESC
       LIMIT 15`
    ).all();

    // Fallback: aggregate by PSČ prefix
    const pscResult = await env.DB.prepare(
      `SELECT psc, COUNT(*) as count
       FROM geo_leads
       GROUP BY psc
       ORDER BY count DESC
       LIMIT 15`
    ).all();

    // Build unified city list
    const cityMap = new Map();

    for (const row of cityResult?.results || []) {
      if (row.city) cityMap.set(row.city, (cityMap.get(row.city) || 0) + row.count);
    }

    for (const row of pscResult?.results || []) {
      const city = PSC_TO_CITY[row.psc] || `PSČ ${row.psc}`;
      if (!cityMap.has(city)) {
        cityMap.set(city, row.count);
      }
    }

    const cities = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Service popularity by region
    const serviceResult = await env.DB.prepare(
      `SELECT service, COUNT(*) as count
       FROM geo_leads
       GROUP BY service
       ORDER BY count DESC
       LIMIT 5`
    ).all();

    const topServices = (serviceResult?.results || []).map((r) => ({
      service: r.service,
      count: r.count,
    }));

    const h3Result = await env.DB.prepare(
      `SELECT h3_hexagon_id, COUNT(*) as count
       FROM geo_leads
       WHERE h3_hexagon_id IS NOT NULL AND h3_hexagon_id != ''
       GROUP BY h3_hexagon_id
       ORDER BY count DESC
       LIMIT 10`
    ).all();

    const topH3 = (h3Result?.results || []).map((r) => ({
      h3: r.h3_hexagon_id,
      count: r.count,
    }));

    // Query raw coordinate points for map rendering
    const pointsResult = await env.DB.prepare(
      `SELECT latitude, longitude, city, service, created_at
       FROM geo_leads
       WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 500`
    ).all();
    const points = pointsResult?.results || [];

    // Postřehy odvozené z REÁLNÝCH dat (žádná AI/mock — pravidlové shrnutí).
    // Zrcadlí logiku týdenního cronu _cron-geo.js (práh 5 pro tip na kampaň).
    const insights = [];
    if (cities.length > 0) {
      const top = cities[0];
      insights.push({
        title: `Nejvíce poptávek: ${top.name}`,
        description: `${top.count}× — největší zájem o služby v tomto regionu.`,
      });
      if (top.count >= 5) {
        insights.push({
          title: `Tip: lokální kampaň pro ${top.name}`,
          description: `Vyšší koncentrace poptávek (${top.count}×) — zvažte cílenou kampaň nebo článek na blog.`,
        });
      }
    }
    if (topServices.length > 0) {
      const s = topServices[0];
      insights.push({
        title: `Nejžádanější služba: ${s.service}`,
        description: `${s.count}× napříč regiony.`,
      });
    }
    if (topH3.length > 0) {
      insights.push({
        title: 'H3 prostorová data aktivní',
        description: `${topH3.length} geobuněk připraveno pro heatmap analýzu.`,
      });
    }

    return json({
      ok: true,
      data: {
        cities,
        topServices,
        topH3,
        points,
        insights,
        totalLeads: cities.reduce((s, c) => s + c.count, 0),
        googleMapsApiKey: env.SECRET_GOOGLE_MAPS_PLATFORM_API || null,
      },
    });
  } catch (err) {
    console.error('[admin/geo] Error:', err);
    return json({ ok: false, error: 'Chyba při načítání GEO dat.' }, 500);
  }
}
