// netlify/functions/places-geocode.js
// Mapy.cz Geocode proxy pro přesné souřadnice a PSČ.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

function normalizeGeocode(body) {
  const features = body && Array.isArray(body.features) ? body.features : [];
  const first = features[0];
  if (!first) return null;

  const props = first.properties || {};
  const coords = Array.isArray(first.geometry && first.geometry.coordinates)
    ? first.geometry.coordinates
    : [];

  return {
    label: props.label || props.name || '',
    city: props.municipality || props.city || '',
    postalCode: props.zip || props.postalCode || '',
    country: props.country || '',
    longitude: coords.length >= 2 ? coords[0] : null,
    latitude: coords.length >= 2 ? coords[1] : null,
    source: 'mapycz',
  };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (query.length < 3) {
    return json({ ok: true, result: null });
  }

  const apiKey = process.env.SECRET_MAPYCZ_API_KEY || process.env.SECRET_MAPY_CZ_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'Mapy.cz API není nakonfigurováno.' }, 503);
  }

  const upstreamUrl = new URL('https://api.mapy.cz/v1/geocode');
  upstreamUrl.searchParams.set('query', query);
  upstreamUrl.searchParams.set('lang', 'cs');
  upstreamUrl.searchParams.set('limit', '1');

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);
    const res = await fetch(upstreamUrl.toString(), {
      headers: {
        'X-Mapy-Api-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: abortController.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return json({ ok: false, error: 'Geocoding selhal.' }, res.status);
    }

    const data = await res.json();
    const result = normalizeGeocode(data);
    return json({ ok: true, result });
  } catch (err) {
    console.error('[places-geocode] Error:', err);
    return json({ ok: false, error: 'Chyba při komunikaci s Mapy.cz' }, 500);
  }
}

export const config = {
  path: '/api/places/geocode',
};
