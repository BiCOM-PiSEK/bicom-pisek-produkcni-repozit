/**
 * Notification Service — Phase 2
 * 
 * Sends email alerts via Resend API.
 * Used by _monitor-health and _perf-log for critical alerts.
 * 
 * Endpoint: POST /api/_notify
 * Payload: { title, severity, category, description, metadata }
 * 
 * Environment variables required:
 *   - RESEND_API_KEY or SECRET_RESEND_API_KEY: Resend API key
 *   - ALERT_EMAIL_TO: Recipient email (admin@bicom-pisek.cz)
 *   - ALERT_EMAIL_FROM: Sender email (alerts@bicom-pisek.cz)
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

function getResendApiKey(env) {
  return env.RESEND_API_KEY || env.SECRET_RESEND_API_KEY || '';
}

function getThrottleSeconds(env) {
  const value = Number.parseInt(env.MONITORING_ALERT_THROTTLE_SECONDS || '300', 10);
  if (!Number.isFinite(value) || value <= 0) {
    return 300;
  }
  return value;
}

function buildThrottleKey({ severity, category, title }) {
  return `monitoring:notify:${severity}:${category}:${title}`.toLowerCase();
}

async function shouldThrottle(env, alert) {
  if (!env.CACHE) {
    return false;
  }

  const key = buildThrottleKey(alert);
  const ttl = getThrottleSeconds(env);

  try {
    const existing = await env.CACHE.get(key);
    if (existing) {
      return true;
    }

    await env.CACHE.put(key, '1', { expirationTtl: ttl });
    return false;
  } catch (error) {
    console.warn('[_notify] KV throttle check failed:', error.message);
    return false;
  }
}

/**
 * Render HTML email template for alert
 */
function renderAlertEmail(alert) {
  const { title, severity, category, description, metadata, timestamp } = alert;

  const severityColor = {
    CRITICAL: '#dc2626',
    HIGH: '#f59e0b',
    MEDIUM: '#eab308',
    LOW: '#6b7280',
  };

  const color = severityColor[severity] || '#6b7280';

  return `
    <!DOCTYPE html>
    <html lang="cs">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .body { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .section { margin-bottom: 16px; }
        .label { font-weight: 600; color: #374151; }
        .value { color: #1f2937; margin-top: 4px; word-break: break-word; }
        .meta { background: white; padding: 12px; border-radius: 4px; font-size: 12px; color: #6b7280; }
        .action { margin-top: 24px; }
        .btn { display: inline-block; background: ${color}; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">🚨 ${severity} Alert — BICOM Písek</h1>
        </div>
        <div class="body">
          <div class="section">
            <div class="label">Alert Type:</div>
            <div class="value">${title}</div>
          </div>

          <div class="section">
            <div class="label">Category:</div>
            <div class="value">${category}</div>
          </div>

          <div class="section">
            <div class="label">Description:</div>
            <div class="value">${description}</div>
          </div>

          ${metadata && metadata.endpoint ? `
          <div class="section">
            <div class="label">Endpoint:</div>
            <div class="value"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${metadata.endpoint}</code></div>
          </div>
          ` : ''}

          ${metadata && metadata.error_message ? `
          <div class="section">
            <div class="label">Error Message:</div>
            <div class="value"><code style="background: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${metadata.error_message}</code></div>
          </div>
          ` : ''}

          ${metadata && metadata.response_time_ms ? `
          <div class="section">
            <div class="label">Response Time:</div>
            <div class="value">${metadata.response_time_ms}ms</div>
          </div>
          ` : ''}

          <div class="section">
            <div class="label">Timestamp:</div>
            <div class="value">${new Date(timestamp).toLocaleString('cs-CZ')}</div>
          </div>

          <div class="meta">
            <strong>Next Steps:</strong>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>Check the monitoring dashboard: https://bicom-pisek.cz/admin/monitoring</li>
              <li>Review related errors in the bug registry</li>
              <li>Consider taking the application offline if severity is CRITICAL</li>
            </ul>
          </div>

          <div class="action">
            <a href="https://bicom-pisek.cz/admin/monitoring" class="btn">Open Monitoring Dashboard</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send email via Resend API
 */
async function sendViaResend(apiKey, from, to, subject, html) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      reply_to: 'info@bicom-pisek.cz',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend API error: ${error.message}`);
  }

  return response.json();
}

/**
 * Core handler
 */
async function handleRequest(request, env) {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const alert = await request.json();
    const { title, severity, category, description, metadata } = alert;

    // Validate required fields
    if (!title || !severity || !category || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, severity, category, description' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const throttled = await shouldThrottle(env, { severity, category, title });
    if (throttled) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Alert throttled',
          timestamp: new Date().toISOString(),
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get configuration from environment
    const apiKey = getResendApiKey(env);
    const emailFrom = env.ALERT_EMAIL_FROM || 'alerts@bicom-pisek.cz';
    const emailTo = env.ALERT_EMAIL_TO || 'admin@bicom-pisek.cz';

    if (!apiKey) {
      console.warn('[_notify] Resend API key not configured (RESEND_API_KEY/SECRET_RESEND_API_KEY). Alert not sent.');
      return new Response(
        JSON.stringify({ error: 'Notification service not configured: missing RESEND_API_KEY/SECRET_RESEND_API_KEY' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Render email
    const html = renderAlertEmail({
      title,
      severity,
      category,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    });

    const subject = `[${severity}] ${title} — BICOM Písek Monitoring`;

    // Send via Resend
    const result = await sendViaResend(apiKey, emailFrom, emailTo, subject, html);

    console.log(`📧 Email sent successfully to ${emailTo} (ID: ${result.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Alert notification sent',
        email_id: result.id,
        sent_to: emailTo,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[_notify] Error sending notification:', error);

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

export async function onRequest(context) {
  return handleRequest(context.request, context.env);
}

export async function onRequestPost(context) {
  return handleRequest(context.request, context.env);
}
