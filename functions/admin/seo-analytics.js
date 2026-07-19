/**
 * BICOM PÍSEK — SEO Search Console Admin API
 * GET /admin/seo-analytics — organické vyhledávání dotazy a prokliky
 */

import { GoogleSearchConsoleConnector } from '../lib/connectors/google-search-console.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strip diacritics for locale-insensitive comparison. */
function stripDiacritics(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getFormattedDate(offsetDays) {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function onRequestGet({ request, env, data }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  const url = new URL(request.url);
  const startDate = url.searchParams.get('startDate') || getFormattedDate(33);
  const endDate = url.searchParams.get('endDate') || getFormattedDate(3);

  // Validate date parameters
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return json({ ok: false, error: 'Neplatný formát data. Použijte YYYY-MM-DD.' }, 400);
  }
  if (startDate > endDate) {
    return json({ ok: false, error: 'startDate musí být dříve nebo rovno endDate.' }, 400);
  }

  try {
    const connector = new GoogleSearchConsoleConnector(env);
    if (!connector.configured) {
      return json({ 
        ok: false, 
        error: 'Google Search Console API není nakonfigurováno na serveru.' 
      }, 503);
    }

    const rows = await connector.getSearchAnalytics({
      startDate,
      endDate,
      rowLimit: 250
    });

    // Analyze regional/local queries
    const localKeywords = ['písek', 'písku', 'strakonic', 'milevsk', 'vodňan', 'protivín', 'blatn'];
    const normalizedKeywords = localKeywords.map(k => stripDiacritics(k));
    const localRows = [];
    const generalRows = [];

    for (const row of rows) {
      const qNorm = stripDiacritics((row.query || '').toLowerCase());
      const isLocal = normalizedKeywords.some(keyword => qNorm.includes(keyword));
      if (isLocal) {
        localRows.push(row);
      } else {
        generalRows.push(row);
      }
    }

    // Sort by clicks and impressions
    const sortByClicks = (a, b) => b.clicks - a.clicks || b.impressions - a.impressions;
    localRows.sort(sortByClicks);
    generalRows.sort(sortByClicks);

    // Impression-weighted average position
    const totalImpressions = rows.reduce((acc, r) => acc + r.impressions, 0);
    const stats = {
      totalClicks: rows.reduce((acc, r) => acc + r.clicks, 0),
      totalImpressions,
      avgPosition: totalImpressions > 0
        ? rows.reduce((acc, r) => acc + r.position * r.impressions, 0) / totalImpressions
        : 0,
      localKeywordsCount: localRows.length,
      generalKeywordsCount: generalRows.length
    };

    return json({
      ok: true,
      data: {
        stats,
        localQueries: localRows.slice(0, 50), // top 50 local queries
        generalQueries: generalRows.slice(0, 50), // top 50 general queries
        startDate,
        endDate
      }
    });

  } catch (err) {
    console.error('[admin/seo-analytics] Error fetching GSC data:', err);
    return json({ 
      ok: false, 
      error: 'Chyba při komunikaci s Google Search Console API: ' + (err.message || 'Neznámá chyba') 
    }, 500);
  }
}
