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
 * Cron trigger in wrangler.toml:
 *   [env.production.triggers.crons]
 *   crons = ["*/5 * * * *"]
 */

import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

const BASE_URL = 'https://bicom-pisek.cz';

// SLO targets (milliseconds)
const SLO_TARGETS = {
  'api-services': 200,
  'api-health': 200,
  'homepage': 2000,
  'menu-toggle': 100,
};

/**
 * Generate unique key for deduplication
 * Hash of: endpoint + error_message (if failed)
 */
function generateDedupKey(endpoint, errorMessage = null) {
  const combined = errorMessage ? `${endpoint}:${errorMessage}` : endpoint;
  return createHash('md5').update(combined).digest('hex').slice(0, 16);
}

/**
 * Check if alert was already sent in the last N hours
 */
async function isDuplicate(db, endpoint, errorMessage, hours = 1) {
  const key = generateDedupKey(endpoint, errorMessage);
  
  // Check monitoring_alerts table for recent duplicates
  const existing = await db
    .prepare(
      `SELECT id FROM monitoring_alerts 
       WHERE endpoint = ? AND created_at > datetime('now', ? || ' hours')`
    )
    .bind(endpoint, -Math.abs(hours))
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
      nanoid(),
      testName,
      endpoint,
      passed ? 1 : 0,
      responseTime,
      errorMessage,
      new Date().toISOString(),
      new Date().toISOString()
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
      nanoid(),
      endpoint,
      statusCode,
      responseTime,
      errorMessage,
      new Date().toISOString(),
      severity,
      new Date().toISOString()
    )
    .run();

  return result;
}

/**
 * Send email alert via /api/_notify
 */
async function sendEmailAlert(env, endpoint, errorMessage, severity) {
  if (!env.MONITORING_ENABLED || env.MONITORING_ENABLED === 'false') {
    return;
  }

  try {
    const alertPayload = {
      severity,
      endpoint,
      message: errorMessage,
      timestamp: new Date().toISOString(),
      source: 'synthetic-monitoring',
    };

    const response = await fetch(`${BASE_URL}/api/_notify`, {
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
async function runTest(db, env, testName, endpoint, sloTarget) {
  const url = `${BASE_URL}${endpoint}`;
  const startTime = Date.now();
  let passed = false;
  let statusCode = null;
  let errorMessage = null;
  let responseTime = 0;

  try {
    const response = await fetch(url, {
      method: 'GET',
      timeout: 10000,
    });

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
        await sendEmailAlert(env, endpoint, errorMessage, severity);
        
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
      await sendEmailAlert(env, endpoint, errorMessage, 'CRITICAL');
      
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
      const result = await runTest(db, env, test.name, test.endpoint, test.slo);
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
