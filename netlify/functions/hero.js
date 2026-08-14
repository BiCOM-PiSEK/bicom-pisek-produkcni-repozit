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
    const cacheKey = 'hero:content';

    // 1. Zkusíme cache
    const cached = await getBlob(cacheKey, 'json', 'bicom-cache');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' },
      });
    }

    // 2. Supabase dotaz
    const supabase = getSupabaseAdmin();
    const { data: hero, error } = await supabase
      .from('hero_content')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const payload = hero || {
      headline: 'Objevte rovnováhu a vitalitu svého těla',
      subline: 'Prémiová biorezonanční péče Bicom Optima v klidném prostředí Písku.',
      cta_primary_text: 'Rezervovat termín',
      cta_primary_url: '#rezervace',
      cta_secondary_text: 'Naše služby',
      cta_secondary_url: '#sluzby',
    };

    // 3. Cache
    await setBlob(cacheKey, payload, 'bicom-cache');

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[api/hero] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Chyba při načítání hero obsahu.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/hero',
};
