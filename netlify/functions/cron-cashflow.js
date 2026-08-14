// netlify/functions/cron-cashflow.js
// Netlify Scheduled Function (spouští se každé pondělí v 9:00: 0 9 * * 1)
// Odesílá týdenní souhrnný report o rezervacích a stavu ordinace do Telegramu.

import { getSupabaseAdmin } from '../lib/supabase.js';
import { TelegramConnector } from '../lib/connectors/telegram.js';

export default async function handler() {
  const supabase = getSupabaseAdmin();
  const telegram = new TelegramConnector(process.env);

  console.log('[cron-cashflow] Generuji týdenní přehled...');

  try {
    const [pendingRes, confirmedRes, doneRes, subscribersRes] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'done'),
      supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    const msg = `📊 *Týdenní přehled — Bicom Písek*\n\n` +
      `⏳ *Čekající rezervace:* ${pendingRes.count || 0}\n` +
      `✅ *Potvrzené termíny:* ${confirmedRes.count || 0}\n` +
      `🎉 *Dokončené terapie celkem:* ${doneRes.count || 0}\n` +
      `✉️ *Odběratelé newsletteru:* ${subscribersRes.count || 0}\n\n` +
      `_Přejeme úspěšný a harmonický týden!_ 🌿`;

    if (telegram.configured) {
      await telegram.sendMessage(msg);
      console.log('[cron-cashflow] Zpráva odeslána do Telegramu.');
    }

    return new Response(JSON.stringify({ status: 'sent' }), { status: 200 });
  } catch (err) {
    console.error('[cron-cashflow] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  schedule: '0 9 * * 1',
};
