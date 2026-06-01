// GET /api/booking-config
// Returns public booking configuration.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet({ env }) {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'stripe_deposit_required'"
    ).first();

    // Default to mandatory ('1') if not explicitly configured in DB
    const required = row ? row.value === '1' : true;

    return new Response(
      JSON.stringify({ stripe_deposit_required: required }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[booking-config] Error:', err);
    // Graceful fallback to default behavior (mandatory)
    return new Response(
      JSON.stringify({ stripe_deposit_required: true }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
