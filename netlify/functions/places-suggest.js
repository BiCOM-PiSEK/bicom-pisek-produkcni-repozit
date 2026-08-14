// netlify/functions/places-suggest.js
// Mapy.cz Suggest / Autocomplete proxy pro našeptávání adres a obcí.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (query.length < 2) {
    return json({ ok: true, items: [] });
  }

  const apiKey = process.env.SECRET_MAPYCZ_API_KEY || process.env.SECRET_MAPY_CZ_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'Mapy.cz API není nakonfigurováno.' }, 503);
  }

  const upstreamUrl = new URL('https://api.mapy.cz/v1/suggest');
  upstreamUrl.searchParams.set('query', query);
  upstreamUrl.searchParams.set('lang', 'cs');
  upstreamUrl.searchParams.set('limit', '5');
  upstreamUrl.searchParams.set('type', 'regional.municipality,regional.address');

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 6000);
    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        'X-Mapy-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: abortController.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return json({ ok: false, error: 'Suggest selhal.' }, res.status);
    }

    const data = await res.json();
    const items = (data?.results || []).map((item) => ({
      name: item.name || '',
      label: item.label || '',
      type: item.type || '',
      location: item.location || '',
      latitude: item.position?.lat || null,
      longitude: item.position?.lon || null,
    }));

    return json({ ok: true, items });
  } catch (err) {
    console.error('[places-suggest] Error:', err);
    return json({ ok: false, error: 'Chyba při komunikaci s Mapy.cz' }, 500);
  }
}

export const config = {
  path: '/api/places/suggest',
};
