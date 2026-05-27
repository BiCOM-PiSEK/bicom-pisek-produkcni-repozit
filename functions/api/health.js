// GET /api/health
// Health check endpoint — verifies D1, KV, and secrets availability.
// Returns structured status for monitoring.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * GET /api/health — System health check.
 */
export async function onRequestGet({ env }) {
  const checks = {
    d1: 'fail',
    kv: 'fail',
    secrets: 'fail',
  };

  // 1. D1 ping
  try {
    const result = await env.DB.prepare('SELECT 1 AS ok').first();
    if (result?.ok === 1) {
      checks.d1 = 'ok';
    }
  } catch (err) {
    console.error('[health] D1 check failed:', err);
  }

  // 2. KV ping
  try {
    // Write and read a test value
    await env.CACHE.put('health:check', 'ok', { expirationTtl: 60 });
    const kvResult = await env.CACHE.get('health:check');
    if (kvResult === 'ok') {
      checks.kv = 'ok';
    }
  } catch (err) {
    console.error('[health] KV check failed:', err);
  }

  // 3. Secrets check (existence only, never expose values)
  try {
    if (env.SECRET_ENCRYPTION_KEY && env.SECRET_ENCRYPTION_KEY.length > 0) {
      checks.secrets = 'ok';
    }
  } catch (err) {
    console.error('[health] Secrets check failed:', err);
  }

  // Determine overall status
  const allOk = Object.values(checks).every((v) => v === 'ok');
  const status = allOk ? 'ok' : 'degraded';

  return new Response(
    JSON.stringify({
      status,
      checks,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
