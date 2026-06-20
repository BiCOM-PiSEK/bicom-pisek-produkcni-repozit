// GET /api/services
// Returns the list of active services.
// Uses KV cache with 1-hour TTL, falls back to D1 query.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CACHE_TTL = 3600; // 1 hour

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/services — List active services.
 * Optional query param: ?category=imunita
 */
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');

    // Build cache key (category-aware)
    const cacheKey = category
      ? `services:category:${category}`
      : 'services:all';

    // 1. Check KV cache
    const cached = await env.CACHE.get(cacheKey, 'json');
    if (cached) {
      return new Response(
        JSON.stringify(cached),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 2. Query D1 — explicitní veřejné sloupce (BEZ draft_json/has_draft,
    //    aby se rozpracovaný koncept nikdy nepropsal na veřejný web).
    let query = `SELECT slug, name, category, segment, short_desc, long_desc,
                        price_avg, price_note, sessions_typ, jsonld, icon_url, sort_order
                 FROM services WHERE active = 1`;
    const bindings = [];

    if (category) {
      query += ' AND category = ?';
      bindings.push(category);
    }

    query += ' ORDER BY sort_order';

    const stmt = bindings.length > 0
      ? env.DB.prepare(query).bind(...bindings)
      : env.DB.prepare(query);

    const { results } = await stmt.all();
    const services = results || [];

    // 3. Cache in KV with TTL
    await env.CACHE.put(cacheKey, JSON.stringify(services), {
      expirationTtl: CACHE_TTL,
    });

    // 4. Return JSON array
    return new Response(
      JSON.stringify(services),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[services] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
