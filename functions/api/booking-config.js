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
    const rowDeposit = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'stripe_deposit_required'"
    ).first();
    const rowPhone = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'require_phone'"
    ).first();

    // Default to optional (false) if not explicitly configured in DB
    const depositRequired = rowDeposit ? rowDeposit.value === '1' : false;
    const phoneRequired = rowPhone ? rowPhone.value === '1' : true;

    const stripeEnabled = Boolean(env.SECRET_STRIPE_SECRET_KEY);
    const turnstileEnabled = Boolean(env.TURNSTILE_SITEKEY && env.TURNSTILE_SECRET_KEY);
    const turnstileSitekey = turnstileEnabled ? env.TURNSTILE_SITEKEY : null;

    return new Response(
      JSON.stringify({
        stripe_enabled: stripeEnabled,
        stripe_deposit_required: stripeEnabled ? depositRequired : false,
        require_phone: phoneRequired,
        turnstile_enabled: turnstileEnabled,
        turnstile_sitekey: turnstileSitekey,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[booking-config] Error:', err);
    return new Response(
      JSON.stringify({
        stripe_enabled: false,
        stripe_deposit_required: false,
        require_phone: true,
        turnstile_enabled: false,
        turnstile_sitekey: null,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}
