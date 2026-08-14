// netlify/functions/cron-reminders.js
// Netlify Scheduled Function (spouští se každou hodinu: 0 * * * *)
// Odesílá e-mailové a SMS připomínky klientům s blížícím se termínem.

import { getSupabaseAdmin } from '../lib/supabase.js';
import { DataCrypt } from '../lib/datacrypt.js';
import { ResendConnector } from '../lib/connectors/resend.js';
import { GoSmsConnector } from '../lib/connectors/gosms.js';

export default async function handler() {
  const supabase = getSupabaseAdmin();
  const env = process.env;
  const encryptionKey = env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const crypt = new DataCrypt(encryptionKey);
  const resend = new ResendConnector(env);
  const gosms = new GoSmsConnector(env);

  const now = new Date().toISOString();

  console.log('[cron-reminders] Hledám neodeslané připomínky...');

  try {
    // 1. Načteme čekající připomínky
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('id, booking_id, channel, send_at, sent, bookings(name_enc, email_enc, phone_enc, service, preferred_date, status)')
      .eq('sent', 0)
      .lte('send_at', now)
      .limit(50);

    if (error || !reminders?.length) {
      console.log('[cron-reminders] Žádné čekající připomínky k odeslání.');
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processedCount = 0;

    for (const item of reminders) {
      const b = item.bookings;
      if (!b || (b.status !== 'pending' && b.status !== 'confirmed')) {
        continue;
      }

      try {
        const [name, email, phone] = await Promise.all([
          crypt.decrypt(b.name_enc),
          crypt.decrypt(b.email_enc),
          crypt.decrypt(b.phone_enc),
        ]);

        if (item.channel === 'email' && email && resend.configured) {
          const subject = 'Připomínka zítřejšího termínu — Bicom Písek';
          const html = `
            <div style="font-family: Arial, sans-serif; color: #2B2B2B;">
              <h2>Dobrý den, ${name},</h2>
              <p>připomínáme váš zítřejší termín v praxi Bicom Písek:</p>
              <div style="background: #FAF8F5; border-left: 4px solid #738A75; padding: 12px; margin: 16px 0;">
                <p><strong>Služba:</strong> ${b.service}</p>
                <p><strong>Termín:</strong> ${b.preferred_date}</p>
              </div>
              <p>Doporučujeme před návštěvou vypít sklenici čisté neperlivé vody a vyhnout se kofeinu. Těšíme se na vás!</p>
              <p style="color: #738A75; font-size: 0.9em;">Tým Bicom Písek<br>Vladislavova 201, 397 01 Písek</p>
            </div>
          `;
          await resend.sendEmail(email, subject, html);
        } else if (item.channel === 'sms' && phone && gosms.configured) {
          const smsText = `Bicom Pisek: Pripominame vas termin ${b.preferred_date} (${b.service}). Tesime se na vas! Tel: 728 227 755`;
          await gosms.sendSms(phone, smsText);
        }

        await supabase.from('reminders').update({ sent: 1 }).eq('id', item.id);
        processedCount++;
      } catch (err) {
        console.error(`[cron-reminders] Chyba u připomínky ${item.id}:`, err);
      }
    }

    console.log(`[cron-reminders] Úspěšně odesláno ${processedCount} připomínek.`);
    return new Response(JSON.stringify({ processed: processedCount }), { status: 200 });
  } catch (err) {
    console.error('[cron-reminders] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  schedule: '0 * * * *',
};
