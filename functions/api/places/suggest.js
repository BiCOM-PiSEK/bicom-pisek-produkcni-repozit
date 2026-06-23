// GET /api/places/suggest?query=...
// Mapy.cz suggest proxy (server-side key storage, lightweight response for autocomplete).

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: CORS_HEADERS });
}

function normalizeSuggestions(body) {
  const rows = body && Array.isArray(body.items) ? body.items : [];
  return rows.map((item) => {
    const location = item.location || {};
    return {
      title: item.name || item.title || '',
      subtitle: item.label || item.subtitle || '',
      city: item.municipality || item.city || '',
      postalCode: item.zip || item.postalCode || '',
      country: item.country || '',
      longitude: location.lng ?? item.lon ?? null,
      latitude: location.lat ?? item.lat ?? null,
      source: 'mapycz',
    };
  }).filter((s) => s.title);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('query') || '').trim();
  if (query.length < 2) {
    return json({ ok: true, suggestions: [] });
  }

  const apiKey = env.SECRET_MAPYCZ_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'Mapy.cz API není nakonfigurováno.' }, 503);
  }

  const upstreamUrl = new URL('https://api.mapy.cz/v1/suggest');
  upstreamUrl.searchParams.set('query', query);
  upstreamUrl.searchParams.set('lang', 'cs');
  upstreamUrl.searchParams.set('limit', '8');

  try {
    const res = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Mapy-Api-Key': apiKey,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return json({ ok: false, error: `Mapy.cz suggest selhal (${res.status}).`, detail: text.slice(0, 300) }, 502);
    }

    const body = await res.json();
    return json({ ok: true, suggestions: normalizeSuggestions(body) });
  } catch (err) {
    console.error('[places/suggest] Upstream error:', err);
    return json({ ok: false, error: 'Nepodařilo se načíst našeptávač adres.' }, 502);
  }
}
