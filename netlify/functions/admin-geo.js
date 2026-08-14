// netlify/functions/admin-geo.js
// GEO-Marketing analytika a regionální rozložení poptávek pro administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const operator = await authenticateOperator(request);
  if (!operator) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Neautorizovaný přístup.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: leads, error } = await supabase
      .from('geo_leads')
      .select('city, postal_code, region, country, h3_index, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const cityStats = {};
    const regionStats = {};

    (leads || []).forEach((item) => {
      if (item.city) {
        cityStats[item.city] = (cityStats[item.city] || 0) + 1;
      }
      if (item.region) {
        regionStats[item.region] = (regionStats[item.region] || 0) + 1;
      }
    });

    return new Response(
      JSON.stringify({
        ok: true,
        total_leads: leads?.length || 0,
        cities: Object.entries(cityStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        regions: Object.entries(regionStats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        recent: (leads || []).slice(0, 20),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při načítání GEO dat.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/geo',
};
