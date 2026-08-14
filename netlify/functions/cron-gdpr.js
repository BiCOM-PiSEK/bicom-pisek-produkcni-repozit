// netlify/functions/cron-gdpr.js
// Netlify Scheduled Function (spouští se denně ve 3:00 ráno: 0 3 * * *)
// GDPR Anonymizace: Odstraňuje osobní údaje (PII) u dokončených nebo zrušených rezervací starších 30 dní.

import { getSupabaseAdmin } from '../lib/supabase.js';
import { recordAuditLog } from '../lib/db-supabase.js';

export default async function handler() {
  const supabase = getSupabaseAdmin();
  console.log('[cron-gdpr] Spouštím kontrolu GDPR anonymizace...');

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: expiredBookings, error: fetchErr } = await supabase
      .from('bookings')
      .select('id')
      .in('status', ['done', 'cancelled'])
      .is('anonymized_at', null)
      .lte('created_at', thirtyDaysAgo);

    if (fetchErr || !expiredBookings?.length) {
      console.log('[cron-gdpr] Žádné záznamy nevyžadují anonymizaci.');
      return new Response(JSON.stringify({ anonymized: 0 }), { status: 200 });
    }

    const ids = expiredBookings.map((b) => b.id);
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        name_enc: 'GDPR_ANONYMIZED',
        email_enc: 'GDPR_ANONYMIZED',
        phone_enc: 'GDPR_ANONYMIZED',
        note_enc: null,
        email_hash: null,
        anonymized_at: now,
      })
      .in('id', ids);

    if (updateErr) {
      throw updateErr;
    }

    await recordAuditLog(
      supabase,
      'bookings',
      'bulk',
      'anonymize',
      'system:cron-gdpr',
      `GDPR anonymizace provedena pro ${ids.length} rezervací`
    );

    console.log(`[cron-gdpr] Úspěšně anonymizováno ${ids.length} rezervací.`);
    return new Response(JSON.stringify({ anonymized: ids.length }), { status: 200 });
  } catch (err) {
    console.error('[cron-gdpr] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  schedule: '0 3 * * *',
};
