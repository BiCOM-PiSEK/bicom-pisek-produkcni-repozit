// GET /api/places/geocode?query=...
// Mapy.cz geocode proxy for precise coordinates and postal code extraction.

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

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (query.length < 3) {
    return json({ ok: true, result: null });
  }

  const apiKey = env.SECRET_MAPYCZ_API_KEY;
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
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Mapy-Api-Key': apiKey,
      },
      signal: abortController.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: `Mapy.cz geocode selhal (${res.status}).`, detail: text.slice(0, 300) }, 502);
    }

    const body = await res.json();
    return json({ ok: true, result: normalizeGeocode(body) });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return json({ ok: false, error: 'Mapy.cz geocode timeout.' }, 504);
    }
    console.error('[places/geocode] Upstream error:', err);
    return json({ ok: false, error: 'Nepodařilo se načíst geokódování adresy.' }, 502);
  }
}
