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
    const galleryKey = url.searchParams.get('key') || 'ordinace';
    const cacheKey = `gallery:${galleryKey}`;

    // 1. Zkusíme Blobs cache
    const cached = await getBlob(cacheKey, 'json', 'bicom-cache');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { ...CORS_HEADERS, 'X-Cache': 'HIT' },
      });
    }

    // 2. Supabase dotaz
    const supabase = getSupabaseAdmin();
    const { data: items, error } = await supabase
      .from('gallery_items')
      .select('id, gallery_key, title, caption, image_url, image_filename, sort_order')
      .eq('gallery_key', galleryKey)
      .eq('active', 1)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    const payload = {
      gallery_key: galleryKey,
      items: items || [],
      count: items?.length || 0,
    };

    // 3. Cache
    await setBlob(cacheKey, payload, 'bicom-cache');

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...CORS_HEADERS, 'X-Cache': 'MISS' },
    });
  } catch (err) {
    console.error('[api/gallery] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Chyba při načítání galerie.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/gallery',
};
