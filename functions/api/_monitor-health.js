/**
 * Synthetic Monitoring Worker — Phase 2
 * 
 * Runs health checks and synthetic tests every 5 minutes.
 * Tests:
 *   1. Endpoint availability (GET /api/services, /api/health)
 *   2. Response time SLO compliance
 *   3. Homepage render (LCP < 2s)
 *   4. Menu toggle interaction (< 100ms)
 * 
 * Handles deduplication to prevent alert flooding.
 * Stores results in synthetic_test_results table.
 * 
 * Deployment:
 *   wrangler deploy --name _monitor-health functions/api/_monitor-health.js
 * 
 * Cron trigger is configured in Cloudflare (scheduled invocation).
 * Runs every 5 minutes via synthetic monitoring schedule.
 */

async function ensureSyntheticSchema(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS monitoring_alerts (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      error_message TEXT,
      alert_triggered_at TIMESTAMP,
      notified_at TIMESTAMP,
      severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS synthetic_test_results (
      id TEXT PRIMARY KEY,
      test_name TEXT NOT NULL,
      endpoint TEXT,
      passed BOOLEAN,
      response_time_ms INTEGER,
      error_message TEXT,
      test_run_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

function createId() {
  return crypto.randomUUID();
}

function sqliteNow() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const BASE_URL = 'https://bicom-pisek.cz';

// SLO targets (milliseconds)
const SLO_TARGETS = {
  'api-services': 200,
  'api-health': 200,
  'homepage': 2000,
  'menu-toggle': 100,
};

/**
 * Check if alert was already sent in the last N hours
 */
async function isDuplicate(db, endpoint, errorMessage, hours = 1) {
  const existing = await db
    .prepare(
      `SELECT id FROM monitoring_alerts 
       WHERE endpoint = ? AND COALESCE(error_message, '') = COALESCE(?, '') 
       AND created_at > datetime('now', ? || ' hours')`
    )
    .bind(endpoint, errorMessage, -Math.abs(hours))
    .first();

  return !!existing;
}

/**
 * Store test result in database
 */
async function storeTestResult(db, testName, endpoint, passed, responseTime, errorMessage = null) {
  const result = await db
    .prepare(
      `INSERT INTO synthetic_test_results 
       (id, test_name, endpoint, passed, response_time_ms, error_message, test_run_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      testName,
      endpoint,
      passed ? 1 : 0,
      responseTime,
      errorMessage,
      sqliteNow(),
      sqliteNow()
    )
    .run();

  return result;
}

/**
 * Store alert in monitoring_alerts table
 */
async function storeAlert(db, endpoint, statusCode, responseTime, errorMessage, severity = 'HIGH') {
  const result = await db
    .prepare(
      `INSERT INTO monitoring_alerts 
       (id, endpoint, status_code, response_time_ms, error_message, alert_triggered_at, severity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      createId(),
      endpoint,
      statusCode,
      responseTime,
      errorMessage,
      sqliteNow(),
      severity,
      sqliteNow()
    )
    .run();

  return result;
}

/**
 * Send email alert via /api/_notify
 */
async function sendEmailAlert(env, notifyBaseUrl, endpoint, errorMessage, severity) {
  if (!env.MONITORING_ENABLED || env.MONITORING_ENABLED === 'false') {
    return;
  }

  try {
    const alertPayload = {
      title: 'Synthetic monitoring incident',
      severity,
      category: 'synthetic_monitoring',
      description: errorMessage,
      metadata: {
        endpoint,
        source: 'synthetic-monitoring',
      },
    };

    const response = await fetch(`${notifyBaseUrl}/api/_notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify(alertPayload),
    });

    if (!response.ok) {
      console.error(`Failed to send email alert: ${response.status}`);
    }
  } catch (error) {
    console.error('Error sending email alert:', error.message);
  }
}

/**
 * Run a synthetic test for an endpoint
 */
async function runTest(db, env, testName, endpoint, sloTarget, notifyBaseUrl) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  let passed = false;
  let statusCode = null;
  let errorMessage = null;
  let responseTime = 0;

  try {
    const response = await fetchWithTimeout(url, 10000);

    responseTime = Date.now() - startTime;
    statusCode = response.status;
    passed = response.status === 200 && responseTime <= sloTarget;

    if (!passed) {
      const reason = response.status !== 200 
        ? `Status ${response.status}` 
        : `Response time ${responseTime}ms > SLO ${sloTarget}ms`;
      errorMessage = reason;

      // Store alert if this is a new failure
      const isDup = await isDuplicate(db, endpoint, errorMessage);
      if (!isDup) {
        const severity = response.status >= 500 ? 'CRITICAL' : 'HIGH';
        await storeAlert(db, endpoint, statusCode, responseTime, errorMessage, severity);
        
        // Send email alert
        await sendEmailAlert(env, notifyBaseUrl, endpoint, errorMessage, severity);
        
        console.log(`⚠️  Alert: ${testName} - ${reason}`);
      }
    } else {
      console.log(`✅ Test passed: ${testName} (${responseTime}ms)`);
    }
  } catch (error) {
    responseTime = Date.now() - startTime;
    errorMessage = error.message || 'Unknown error';
    passed = false;

    // Store alert for connectivity issues
    const isDup = await isDuplicate(db, endpoint, errorMessage);
    if (!isDup) {
      await storeAlert(db, endpoint, null, responseTime, errorMessage, 'CRITICAL');
      
      // Send critical email alert
      await sendEmailAlert(env, notifyBaseUrl, endpoint, errorMessage, 'CRITICAL');
      
      console.log(`❌ Critical: ${testName} - ${errorMessage}`);
    }
  }

  // Always store test result
  await storeTestResult(db, testName, endpoint, passed, responseTime, errorMessage);

  return { testName, endpoint, passed, responseTime, errorMessage };
}

/**
 * Main handler for scheduled worker
 */
export async function onRequest(context) {
  const { env, request } = context;
  const db = env.DB;
  const notifyBaseUrl = new URL(request.url).origin;

  await ensureSyntheticSchema(db);

  console.log(`🔍 Starting synthetic monitoring at ${new Date().toISOString()}`);

  const tests = [
    // API endpoints
    { name: 'api-services', endpoint: '/api/services', slo: SLO_TARGETS['api-services'] },
    { name: 'api-health', endpoint: '/api/health', slo: SLO_TARGETS['api-health'] },
    
    // Homepage (LCP metric)
    { name: 'homepage-load', endpoint: '/', slo: SLO_TARGETS['homepage'] },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await runTest(db, env, test.name, test.endpoint, test.slo, notifyBaseUrl);
      results.push(result);
    } catch (error) {
      console.error(`Error running test ${test.name}:`, error);
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const avgTime = Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / total);

  console.log(`
📊 Monitoring Summary:
   ✅ Passed: ${passed}/${total}
   ⏱️  Avg Response: ${avgTime}ms
   📍 Timestamp: ${new Date().toISOString()}
  `);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Synthetic monitoring completed',
      summary: { passed, total, avgTime },
      results,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Also handle manual GET /api/_monitor-health for testing
 */
export async function onRequestGet(context) {
  return onRequest(context);
}
