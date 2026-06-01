// GET /admin/payments
// Returns Stripe transaction lists and financial statistics.

import { DataCrypt } from '../lib/datacrypt.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestGet({ env, data }) {
  const operator = data.operator;
  if (!operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const db = env.DB;
    
    // 1. Fetch total stats from transactions
    const statsResult = await db.prepare(
      `SELECT COUNT(*) as count, SUM(amount) as total 
       FROM payment_transactions 
       WHERE status = 'completed'`
    ).first();

    const totalRevenue = statsResult?.total || 0;
    const paymentCount = statsResult?.count || 0;

    // 2. Fetch list of transactions joined with bookings
    const txResult = await db.prepare(
      `SELECT t.id, t.stripe_session_id, t.amount, t.status, t.created_at,
              b.name_enc, b.service, b.preferred_date
       FROM payment_transactions t
       JOIN bookings b ON t.booking_id = b.id
       ORDER BY t.created_at DESC
       LIMIT 100`
    ).all();

    // 3. Decrypt client names for display
    let transactions = [];
    if (txResult?.results?.length > 0 && env.SECRET_ENCRYPTION_KEY) {
      const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
      transactions = await Promise.all(
        txResult.results.map(async (tx) => {
          let name = '(šifrováno)';
          try {
            name = await crypt.decrypt(tx.name_enc);
          } catch { /* fallback */ }
          return {
            id: tx.id,
            stripeSessionId: tx.stripe_session_id,
            amount: tx.amount,
            status: tx.status,
            createdAt: tx.created_at,
            clientName: name,
            service: tx.service,
            preferredDate: tx.preferred_date,
          };
        })
      );
    } else if (txResult?.results) {
      transactions = txResult.results.map((tx) => ({
        id: tx.id,
        stripeSessionId: tx.stripe_session_id,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.created_at,
        clientName: '(šifrováno — klíč nedostupný)',
        service: tx.service,
        preferredDate: tx.preferred_date,
      }));
    }

    return json({
      ok: true,
      data: {
        totalRevenue,
        paymentCount,
        transactions,
      },
    });

  } catch (err) {
    console.error('[admin/payments] Error:', err);
    return json({ ok: false, error: 'Interní chyba při načítání plateb.' }, 500);
  }
}
