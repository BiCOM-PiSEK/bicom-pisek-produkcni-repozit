/**
 * BICOM PÍSEK — SEO Search Console Admin API
 * GET /admin/seo-analytics — organické vyhledávání dotazy a prokliky
 */

import { GoogleSearchConsoleConnector } from '../lib/connectors/google-search-console.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

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
    const localRows = [];
    const generalRows = [];

    for (const row of rows) {
      const qLower = (row.query || '').toLowerCase();
      const isLocal = localKeywords.some(keyword => qLower.includes(keyword));
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

    const stats = {
      totalClicks: rows.reduce((acc, r) => acc + r.clicks, 0),
      totalImpressions: rows.reduce((acc, r) => acc + r.impressions, 0),
      avgPosition: rows.length > 0 ? (rows.reduce((acc, r) => acc + r.position, 0) / rows.length) : 0,
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
