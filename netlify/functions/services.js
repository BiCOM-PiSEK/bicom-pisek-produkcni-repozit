import { getSupabaseAdmin } from '../lib/supabase.js';
import { getBlob, setBlob } from '../lib/blobs.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const cacheKey = category ? `services:category:${category}` : 'services:all';

    // 1. Zkusíme načíst z Netlify Blobs cache
    const cached = await getBlob(cacheKey, 'json', 'bicom-cache');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' },
      });
    }

    // 2. Dotaz do Supabase
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('services')
      .select('slug, name, category, segment, short_desc, long_desc, price_avg, price_note, sessions_typ, jsonld, icon_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: services, error } = await query;
    if (error) {
      throw error;
    }

    const payload = {
      services: services || [],
      count: services?.length || 0,
      timestamp: new Date().toISOString(),
    };

    // 3. Uložíme do Netlify Blobs cache (na 1 hodinu)
    await setBlob(cacheKey, payload, 'bicom-cache');

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[api/services] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Chyba při načítání služeb.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/services',
};
