import { getSupabaseAdmin } from '../lib/supabase.js';

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

  const start = Date.now();
  let dbStatus = 'unknown';

  try {
    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true });

    dbStatus = error ? `error: ${error.message}` : 'healthy';
  } catch (err) {
    dbStatus = `unreachable: ${err.message}`;
  }

  const latency = Date.now() - start;

  return new Response(
    JSON.stringify({
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      platform: 'Netlify Functions (v2)',
      database: 'Supabase (PostgreSQL)',
      db_status: dbStatus,
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    }),
    {
      status: dbStatus === 'healthy' ? 200 : 503,
      headers: CORS_HEADERS,
    }
  );
}

export const config = {
  path: '/api/health',
};
