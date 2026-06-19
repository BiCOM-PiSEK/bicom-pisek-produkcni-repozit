// POST /api/stripe-webhook
// Handles Stripe webhooks, verifies signatures, updates database, and triggers integrations.

import { DataCrypt } from '../lib/datacrypt.js';
import { IDokladConnector } from '../lib/connectors/idoklad.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost({ request, env }) {
  const signatureHeader = request.headers.get('stripe-signature');
  const payload = await request.text();
  const webhookSecret = env.SECRET_STRIPE_WEBHOOK_SECRET;

  if (!signatureHeader || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'missing_auth' }), { status: 400, headers: CORS_HEADERS });
  }

  // 1. Verify Stripe Webhook Signature
  const isValid = await verifyStripeSignature(payload, signatureHeader, webhookSecret);
  if (!isValid) {
    console.warn('[stripe-webhook] Signature verification failed');
    return new Response(JSON.stringify({ error: 'invalid_signature' }), { status: 401, headers: CORS_HEADERS });
  }

  try {
    const event = JSON.parse(payload);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (!bookingId) {
        console.warn('[stripe-webhook] Missing bookingId in metadata');
        return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS_HEADERS });
      }

      // Fetch booking from D1 to get info
      const booking = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(bookingId).first();
      if (!booking) {
        console.error(`[stripe-webhook] Booking not found in D1: ${bookingId}`);
        return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: CORS_HEADERS });
      }
      const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
      const [clientName, clientEmail, clientPhone] = await Promise.all([
        crypt.decrypt(booking.name_enc),
        crypt.decrypt(booking.email_enc),
        crypt.decrypt(booking.phone_enc),
      ]);

      const paidAmount = session.amount_total / 100; // convert cents to CZK

      // 2. Idempotent DB write with recovery path for duplicate deliveries
      const txExists = await env.DB.prepare(
        'SELECT id FROM payment_transactions WHERE stripe_session_id = ? LIMIT 1'
      ).bind(session.id).first();
      if (!txExists) {
        await env.DB.batch([
          env.DB.prepare(
            `INSERT OR IGNORE INTO payment_transactions (id, booking_id, stripe_session_id, amount, status)
             VALUES (?, ?, ?, ?, 'completed')`
          ).bind(crypto.randomUUID(), bookingId, session.id, paidAmount),
          env.DB.prepare(
            `UPDATE bookings 
             SET status = 'pending', stripe_payment_status = 'paid', 
                 stripe_payment_intent_id = ?, paid_amount = ?, paid_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(session.payment_intent, paidAmount, bookingId),
          env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'bookings', ?, 'update', 'system', 'Stripe payment confirmed, booking status set to pending')`
          ).bind(crypto.randomUUID(), bookingId)
        ]);
      } else if (booking.stripe_payment_status !== 'paid') {
        console.warn(`[stripe-webhook] Recovery path: transaction exists but booking not marked paid (${bookingId})`);
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE bookings 
             SET status = 'pending', stripe_payment_status = 'paid', 
                 stripe_payment_intent_id = ?, paid_amount = ?, paid_at = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(session.payment_intent, paidAmount, bookingId),
          env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'bookings', ?, 'update', 'system', 'Stripe payment recovery update applied after duplicate webhook delivery')`
          ).bind(crypto.randomUUID(), bookingId)
        ]);
      } else {
        console.info(`[stripe-webhook] Duplicate delivery detected for session ${session.id}`);
      }

      // 4. Optional: Automatically issue invoice in iDoklad
      const idoklad = new IDokladConnector(env);
      if (idoklad.configured) {
        try {
          console.info(`[stripe-webhook] Issuing iDoklad invoice for booking ${bookingId}...`);
          const invoice = await idoklad.createInvoice(
            {
              name: clientName,
              email: clientEmail,
              street: '',
              city: '',
              postalCode: booking.psc || '',
            },
            [{
              name: `Záloha na biorezonanci Bicom — ${booking.service}`,
              unitPrice: paidAmount,
              amount: 1,
            }]
          );
          if (invoice) {
            console.info(`[stripe-webhook] iDoklad invoice created: ${invoice.DocumentNumber || invoice.Id}`);
            // Log invoice details in audit log
            await env.DB.prepare(
              `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
               VALUES (?, 'invoices', ?, 'create', 'system', ?)`
            ).bind(
              crypto.randomUUID(),
              String(invoice.Id || ''),
              `Automated invoice issued for Stripe payment. Invoice number: ${invoice.DocumentNumber || 'N/A'}`
            ).run();
          }
        } catch (err) {
          console.error('[stripe-webhook] Automated iDoklad invoicing failed:', err);
        }
      }

      // 5. Send async job (or retry it on duplicate webhook until booking gets calendar_event_id)
      if (!booking.calendar_event_id) {
        await env.BOOKING_QUEUE.send({
          bookingId,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          service: booking.service,
          preferred_date: booking.preferred_date,
          slot_start: booking.slot_start,
          slot_end: booking.slot_end,
          estimated_price: booking.estimated_price,
          stripe_paid: true,
          reminder_channel: booking.reminder_channel || 'email',
        });
      } else {
        console.info(`[stripe-webhook] Queue dispatch skipped: booking ${bookingId} already has calendar_event_id.`);
      }

      console.info(`[stripe-webhook] Successfully processed paid booking: ${bookingId}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    console.error('[stripe-webhook] Error processing webhook:', err);
    return new Response(JSON.stringify({ error: 'processing_failed' }), { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Verify signature from Stripe headers using HMAC-SHA256 (Web Crypto API).
 */
async function verifyStripeSignature(payload, signatureHeader, secret) {
  try {
    const parts = signatureHeader.split(',');
    const tPart = parts.find((p) => p.trim().startsWith('t='));
    const v1Part = parts.find((p) => p.trim().startsWith('v1='));

    if (!tPart || !v1Part) return false;

    const t = tPart.split('=')[1].trim();
    const v1 = v1Part.split('=')[1].trim();

    // Replay attack check: 10-minute tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(t, 10)) > 600) {
      console.warn('[stripe-webhook] Signature timestamp is too old or in future');
      return false;
    }

    const message = `${t}.${payload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    // Convert signature array buffer to hex string
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return expectedSignature === v1;
  } catch (err) {
    console.error('[stripe-webhook] Signature verification error:', err);
    return false;
  }
}
