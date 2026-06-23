/**
 * Performance Log Endpoint — Phase 2
 * 
 * Receives frontend performance events and logs from performance-logger.js
 * Handles deduplication and stores in bug_registry.
 * 
 * Endpoint: POST /api/_perf-log
 * Payload: { sessionId, events: [{category, metadata, ...}], timestamp }
 * 
 * Features:
 *   - Event deduplication via MD5 hash
 *   - Auto-group similar errors
 *   - Trigger alerts for CRITICAL/HIGH severity
 *   - Store in bug_registry with occurrence counting
 */

import { nanoid } from 'nanoid';

/**
 * Simple hash function for deduplication (Web Crypto compatible)
 */
async function simpleHash(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

/**
 * Generate unique key for deduplication
 * Hash of: category + message (to group similar errors)
 */
async function generateDedupKey(category, message = '') {
  const combined = `${category}:${message}`;
  return await simpleHash(combined);
}

/**
 * Extract error message from event metadata
 */
function extractMessage(event) {
  const { category, metadata } = event;
  if (category.includes('error')) {
    return metadata.message || metadata.reason || 'Unknown error';
  }
  if (category.includes('web_vital')) {
    return `${category} = ${metadata.value}`;
  }
  return category;
}

/**
 * Check if event was already logged in the last N hours
 */
async function isDuplicate(db, dedupKey, hours = 1) {
  const existing = await db
    .prepare(
      `SELECT id, occurrences FROM bug_registry 
       WHERE id = ? AND created_at > datetime('now', ? || ' hours')`
    )
    .bind(dedupKey, -Math.abs(hours))
    .first();

  return existing;
}

/**
 * Determine severity based on event type and metadata
 */
function determineSeverity(event) {
  const { category, metadata } = event;

  // Critical: JavaScript errors, unhandled rejections
  if (category.includes('error_javascript') || category.includes('error_unhandled')) {
    return 'CRITICAL';
  }

  // High: Console errors, form submission errors
  if (category.includes('error_console') || category === 'dom_event_booking_submit') {
    return 'HIGH';
  }

  // High: SLO violations (LCP > 2s, INP > 200ms, CLS > 0.1)
  if (category.includes('web_vital')) {
    const value = parseFloat(metadata.value);
    if (category === 'web_vital_lcp' && value > 2000) return 'HIGH';
    if (category === 'web_vital_inp' && value > 200) return 'HIGH';
    if (category === 'web_vital_cls' && value > 0.1) return 'HIGH';
    if (category === 'web_vital_fcp' && value > 1800) return 'MEDIUM';
  }

  // Medium: Performance issues, slow interactions
  if (category.includes('dom_event')) {
    const duration = metadata.duration_ms;
    if (duration && duration > 100) return 'MEDIUM';
  }

  return 'LOW';
}

/**
 * Store event in bug_registry
 */
async function storeBugReport(db, dedupKey, title, category, severity, description, metadata) {
  const existing = await isDuplicate(db, dedupKey);

  if (existing) {
    // Update existing report: increment counter and update last_seen
    await db
      .prepare(
        `UPDATE bug_registry 
         SET occurrences = occurrences + 1, 
             last_seen_at = ?,
             metadata = ?
         WHERE id = ?`
      )
      .bind(
        new Date().toISOString(),
        JSON.stringify(metadata),
        dedupKey
      )
      .run();

    console.log(`📊 Bug report updated: ${dedupKey} (occurrences: ${existing.occurrences + 1})`);
    return existing;
  } else {
    // Insert new bug report
    await db
      .prepare(
        `INSERT INTO bug_registry 
         (id, title, category, severity, status, description, first_reported_at, last_seen_at, occurrences, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        dedupKey,
        title,
        category,
        severity,
        'open',
        description,
        new Date().toISOString(),
        new Date().toISOString(),
        1,
        JSON.stringify(metadata),
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    console.log(`🆕 New bug report: ${dedupKey} (severity: ${severity})`);
    return null; // New report
  }
}

/**
 * Trigger alert for high-severity issues
 */
async function triggerAlertIfNeeded(db, env, event, severity, dedupKey, isNew) {
  // Only alert for CRITICAL and HIGH severity, and only for NEW issues
  if ((severity === 'CRITICAL' || severity === 'HIGH') && isNew) {
    const message = extractMessage(event);

    await db
      .prepare(
        `INSERT INTO monitoring_alerts 
         (id, endpoint, error_message, alert_triggered_at, severity, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        nanoid(),
        `/api/_perf-log`,
        `${event.category}: ${message}`,
        new Date().toISOString(),
        severity,
        new Date().toISOString()
      )
      .run();

    console.log(`🚨 Alert triggered: ${event.category} - ${severity}`);

    // Send email notification via _notify endpoint
    if (env.MONITORING_ENABLED && env.MONITORING_ENABLED !== 'false') {
      try {
        await fetch('https://bicom-pisek.cz/api/_notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': env.INTERNAL_API_SECRET || '',
          },
          body: JSON.stringify({
            severity,
            endpoint: `/api/_perf-log`,
            message: `${event.category}: ${message}`,
            timestamp: new Date().toISOString(),
            source: 'frontend-performance',
          }),
        });
      } catch (error) {
        console.error('Failed to send email alert:', error.message);
      }
    }
  }
}

/**
 * Main handler
 */
export async function onRequest(request, env) {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { sessionId, events, timestamp } = await request.json();

    if (!events || !Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload: missing events array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB;
    const processed = [];
    let alertsTriggered = 0;

    // Process each event
    for (const event of events) {
      const { category, metadata } = event;
      const message = extractMessage(event);
      const dedupKey = await generateDedupKey(category, message);
      const severity = determineSeverity(event);

      // Store bug report (or update if duplicate)
      const existingReport = await storeBugReport(
        db,
        dedupKey,
        category,
        category,
        severity,
        message,
        { ...metadata, sessionId }
      );

      const isNewReport = !existingReport;

      // Trigger alert if needed
      await triggerAlertIfNeeded(db, env, event, severity, dedupKey, isNewReport);

      if (isNewReport && (severity === 'CRITICAL' || severity === 'HIGH')) {
        alertsTriggered++;
      }

      processed.push({
        category,
        dedupKey,
        severity,
        isNew: isNewReport,
      });
    }

    console.log(`✅ Processed ${processed.length} events (${alertsTriggered} alerts triggered)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Events processed',
        processed: processed.length,
        alertsTriggered,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[_perf-log] Error processing request:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function onRequestPost(context) {
  return onRequest(context.request, context.env);
}
