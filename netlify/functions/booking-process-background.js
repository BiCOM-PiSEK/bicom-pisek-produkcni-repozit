// netlify/functions/booking-process-background.js
// Netlify Background Function (běh do 15 min na pozadí).
// Asynchronně odešle e-maily přes Resend, notifikaci do Telegramu a zapíše událost do Google Kalendáře.

import { ResendConnector } from '../lib/connectors/resend.js';
import { TelegramConnector } from '../lib/connectors/telegram.js';
import { GoogleCalendarConnector } from '../lib/connectors/google-calendar.js';
import { getSupabaseAdmin } from '../lib/supabase.js';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const { bookingId, name, email, phone, service, preferred_date, note } = payload;
  const env = process.env;
  const supabase = getSupabaseAdmin();

  console.log(`[booking-process-background] Zpracovávám rezervaci ${bookingId} pro ${email}...`);

  // 1. Odeslání e-mailu klientovi přes Resend
  try {
    const resend = new ResendConnector(env);
    if (resend.configured) {
      const subject = 'Potvrzení přijetí vaší rezervace — Bicom Písek';
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2B2B2B;">
          <h2 style="color: #3A4A3C;">Dobrý den, ${name},</h2>
          <p>děkujeme za vaši rezervaci v praxi <strong>Bicom Písek</strong>.</p>
          <div style="background-color: #FAF8F5; border-left: 4px solid #738A75; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Zvolená péče:</strong> ${service}</p>
            <p style="margin: 5px 0;"><strong>Preferovaný termín:</strong> ${preferred_date}</p>
            ${note ? `<p style="margin: 5px 0;"><strong>Vaše poznámka:</strong> ${note}</p>` : ''}
          </div>
          <p>Váš termín nyní zkontrolujeme a potvrdíme. Pokud byste potřebovali cokoliv změnit, odpovězte na tento e-mail nebo volejte naši recepci.</p>
          <p style="margin-top: 30px; font-size: 0.9em; color: #738A75;">S úctou,<br>Tým Bicom Písek<br>Vladislavova 201, 397 01 Písek</p>
        </div>
      `;

      await resend.sendEmail(email, subject, htmlBody);
      console.log(`[booking-process-background] E-mail odeslán na ${email}`);

      // Notifikace pro ordinaci
      const adminSubject = `🔔 Nová rezervace: ${name} (${service})`;
      const adminHtml = `
        <h3>Nová rezervace z webu</h3>
        <p><strong>Jméno:</strong> ${name}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone}</p>
        <p><strong>Služba:</strong> ${service}</p>
        <p><strong>Termín:</strong> ${preferred_date}</p>
        <p><strong>Poznámka:</strong> ${note || 'bez poznámky'}</p>
      `;
      await resend.sendEmail(env.NOTIFICATION_EMAIL || 'info@bicom-pisek.cz', adminSubject, adminHtml);
    }
  } catch (err) {
    console.error('[booking-process-background] Resend error:', err);
  }

  // 2. Telegram notifikace personálu
  try {
    const telegram = new TelegramConnector(env);
    if (telegram.configured) {
      const msg = `🔔 *Nová rezervace termínu*\n\n👤 *Klient:* ${name}\n📞 *Telefon:* ${phone}\n✉️ *E-mail:* ${email}\n🌿 *Služba:* ${service}\n📅 *Termín:* ${preferred_date}\n📝 *Poznámka:* ${note || '—'}`;
      await telegram.sendMessage(msg);
      console.log('[booking-process-background] Telegram notifikace odeslána');
    }
  } catch (err) {
    console.error('[booking-process-background] Telegram error:', err);
  }

  // 3. Zápis do Google Kalendáře (pokud je nakonfigurován)
  try {
    const calendar = new GoogleCalendarConnector(env);
    if (calendar.configured) {
      const eventRes = await calendar.createEvent({
        summary: `Bicom: ${name} — ${service}`,
        description: `Klient: ${name}\nTelefon: ${phone}\nE-mail: ${email}\nPoznámka: ${note || ''}`,
        startDateTime: preferred_date,
      });

      if (eventRes?.id) {
        await supabase
          .from('bookings')
          .update({ calendar_event_id: eventRes.id, confirmation_sent_at: new Date().toISOString() })
          .eq('id', bookingId);
      }
    }
  } catch (err) {
    console.error('[booking-process-background] Google Calendar error:', err);
  }

  // Aktualizace času potvrzení
  try {
    await supabase
      .from('bookings')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', bookingId);
  } catch {
    // ignore
  }

  return new Response(JSON.stringify({ status: 'completed' }), { status: 200 });
}
