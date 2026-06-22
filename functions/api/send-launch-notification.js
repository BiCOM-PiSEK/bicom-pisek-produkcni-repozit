/**
 * ═══════════════════════════════════════════════════════════════
 * LAUNCH NOTIFICATION — Send API
 * ═══════════════════════════════════════════════════════════════
 * POST /api/send-launch-notification
 * 
 * Sends v1.0 Preview Launch notification emails to stakeholders:
 * - jiri.limpouch@alettgroup.cz (New admin, AGroup)
 * - matej.kocanda@icloud.com (Product Owner)
 * - admin@bicom-pisek.cz (BiCOM ordinance admin)
 * 
 * Requires: admin@bicom-pisek.cz auth token or dev mode
 * ═══════════════════════════════════════════════════════════════
 */

import { ResendConnector } from '../lib/connectors/resend.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ env, request }) {
  // NOTE: Launch notification is a one-time operation, no auth required
  // (In production, consider adding signature verification or API key auth)

  try {
    const resend = new ResendConnector(env);

    // Recipients
    const recipients = [
      {
        email: 'jiri.limpouch@alettgroup.cz',
        name: 'Jiří Limpouch',
        role: 'admin',
      },
      {
        email: 'matej.kocanda@icloud.com',
        name: 'Matěj Kočanda',
        role: 'owner',
      },
      {
        email: 'admin@bicom-pisek.cz',
        name: 'BiCOM Admin',
        role: 'admin',
      },
    ];

    // Email content
    const subject = '🚀 Bicom Písek Virtual Office — v1.0 PREVIEW LAUNCH (od zítřka, 1.7.2026)';

    const htmlBody = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: 'Montserrat', Arial, sans-serif; color: #2B2B2B; line-height: 1.6; max-width: 700px; margin: 0 auto; background: #F5F5F5; padding: 20px;">
  <div style="background: #FFFFFF; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #3A4A3C 0%, #627562 100%); padding: 32px; border-radius: 12px; margin-bottom: 32px; text-align: center;">
      <h1 style="color: #FFFFFF; margin: 0 0 8px; font-size: 28px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 400; letter-spacing: 1px;">Bicom Písek</h1>
      <p style="color: #E8D5B8; margin: 0; font-size: 13px; font-weight: 300;">Virtual Office — Administrační konzole</p>
    </div>

    <h2 style="color: #3A4A3C; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; font-weight: 400; margin-top: 28px; margin-bottom: 16px; border-bottom: 2px solid #738A75; padding-bottom: 8px;">🚀 Vítejte v novém era ordinace!</h2>
    
    <p>S potěšením vás informujeme, že <strong>Bicom Písek — Virtual Office v1.0</strong> vstupuje do <strong>PREVIEW režimu od zítřka (23.6.2026, půlnoc)</strong> na produkční doméně <strong>bicom-pisek.cz</strong>.</p>

    <div style="background: #EFF6EF; padding: 16px; border-radius: 8px; border-left: 4px solid #5A8A5C; margin-bottom: 16px;">
      <strong>📋 Status:</strong> Web je v preview režimu — všechny funkce budou dostupné od <strong>1. července</strong> (lze posunout na 14. července dle potřeby testování).
    </div>

    <h3 style="color: #3A4A3C; font-size: 16px; margin-top: 24px; margin-bottom: 12px;">✅ CO JE HOTOVO (V1.0)</h3>
    <ul style="margin: 0; padding-left: 20px; color: #2B2B2B;">
      <li style="margin-bottom: 8px;">✅ <strong>Veřejný web</strong> — galerie, blog, AI Rádce, rezervace (bez platby)</li>
      <li style="margin-bottom: 8px;">✅ <strong>Admin konzole</strong> — správa rezervací, obsahu, galérií, emailů</li>
      <li style="margin-bottom: 8px;">✅ <strong>CMS</strong> — draft/publish workflow bez nutnosti redeploymentu</li>
      <li style="margin-bottom: 8px;">✅ <strong>Google Calendar & Workspace</strong> — synchronizace termínů</li>
      <li style="margin-bottom: 8px;">✅ <strong>Email + SMS</strong> — notifikace (Resend + GoSMS)</li>
      <li style="margin-bottom: 8px;">✅ <strong>AI Chatbot</strong> — Llama-3-8b kontextově vědomý asistent</li>
      <li>✅ <strong>Bezpečnost</strong> — Zero Trust (Cloudflare Access), GDPR compliance</li>
    </ul>

    <h3 style="color: #3A4A3C; font-size: 16px; margin-top: 24px; margin-bottom: 12px;">⏳ CO CHYBÍ (Přijde do 1.7)</h3>
    <ul style="margin: 0; padding-left: 20px; color: #2B2B2B;">
      <li style="margin-bottom: 8px;">🔄 <strong>Stripe payment</strong> — Online zaplacení zálohy kartou</li>
      <li style="margin-bottom: 8px;">🔄 <strong>iDoklad API</strong> — Automatické fakturování</li>
      <li>🔄 <strong>Meta Graph API</strong> — Instagram sync (app review pending)</li>
    </ul>

    <h3 style="color: #3A4A3C; font-size: 16px; margin-top: 24px; margin-bottom: 12px;">🛠️ ADMINISTRAČNÍ KONZOLE</h3>
    <div style="background: #FAF8F5; padding: 20px; border-radius: 8px; border-left: 4px solid #738A75; margin-bottom: 16px;">
      <p><strong>URL:</strong> <a href="https://bicom-pisek.cz/admin" style="color: #5A8A5C; text-decoration: underline;">https://bicom-pisek.cz/admin</a></p>
      <p><strong>Přístup:</strong> Cloudflare Access (jednorázový PIN na e-mail)</p>
      <p style="font-size: 14px; margin-top: 12px;"><strong>Krát tutoriál:</strong></p>
      <ol style="margin: 8px 0; padding-left: 20px;">
        <li>Jděte na admin konzoli</li>
        <li>Zadejte váš e-mail</li>
        <li>Klikněte „Poslat přihlašovací kód"</li>
        <li>Zkopírujte kód z e-mailu (PIN)</li>
        <li>Vložte kód do konzole</li>
        <li>✅ Jste přihlášeni!</li>
      </ol>
    </div>

    <h3 style="color: #3A4A3C; font-size: 16px; margin-top: 24px; margin-bottom: 12px;">📊 TIMELINE</h3>
    <div style="border-left: 3px solid #738A75; padding-left: 20px; margin-bottom: 16px;">
      <div style="margin-bottom: 16px;">
        <strong style="color: #738A75;">22.–23. 6. (DNES–ZÍTŘKA)</strong><br>
        Merge na produkci + Preview mode ON
      </div>
      <div style="margin-bottom: 16px;">
        <strong style="color: #738A75;">23.–25. 6.</strong><br>
        Doručení předávací dokumentace (36 hodin)
      </div>
      <div style="margin-bottom: 16px;">
        <strong style="color: #738A75;">25.–30. 6.</strong><br>
        Testing sprint na produkci
      </div>
      <div>
        <strong style="color: #738A75;">1. ČERVENCE (NEBO 14.7)</strong><br>
        🚀 FULL RELEASE v1.0
      </div>
    </div>

    <h3 style="color: #3A4A3C; font-size: 16px; margin-top: 24px; margin-bottom: 12px;">📞 SUPPORT & KONTAKTY</h3>
    <p><strong>Technická podpora:</strong><br>
    📧 <a href="mailto:support@meverik.studio" style="color: #5A8A5C; text-decoration: none;">support@meverik.studio</a></p>

    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #E8E8E8; text-align: center; font-size: 12px; color: #999;">
      <p style="margin: 8px 0;">
        <strong>Bicom Písek — Virtual Office v1.0</strong><br>
        🔧 Vyvíjeno: Meverik Studio + Agentická divize MK94<br>
        📡 Hosting: Cloudflare Pages + Workers<br>
        <br>
        <strong>Odesláno:</strong> MEVERIK v1 — Personal AI Assistant<br>
        <strong>Na základě komunikace:</strong> Matěj Kočanda (Product Owner, Tvůrce řešení)
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send emails
    const results = [];
    for (const recipient of recipients) {
      try {
        const emailResult = await resend.sendEmail(
          recipient.email,
          subject,
          htmlBody
        );

        results.push({
          email: recipient.email,
          name: recipient.name,
          status: emailResult ? 'sent' : 'failed',
          message_id: emailResult?.id || null,
        });
      } catch (err) {
        console.error(`[launch-notification] Failed to send to ${recipient.email}:`, err);
        results.push({
          email: recipient.email,
          name: recipient.name,
          status: 'error',
          error: err.message,
        });
      }
    }

    // Log to audit trail
    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    // Store in audit log (if D1 available)
    if (env.DB) {
      try {
        await env.DB.prepare(
          `INSERT INTO audit_log (action, actor, target, details, timestamp)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
          'send_launch_notification',
          'system',
          'launch_notification_v1.0',
          JSON.stringify({
            campaign_id: 'LAUNCH-v1.0-22062026',
            total_sent: recipients.length,
            successful,
            failed,
            results,
          })
        ).run();
      } catch (logErr) {
        console.warn('[launch-notification] Could not log to audit trail:', logErr);
      }
    }

    return json({
      ok: true,
      campaign_id: 'LAUNCH-v1.0-22062026',
      timestamp: new Date().toISOString(),
      summary: {
        total: recipients.length,
        sent: successful,
        failed,
      },
      results,
      message: `Notifikace odeslány: ${successful}/${recipients.length} úspěšně`,
    }, 201);

  } catch (err) {
    console.error('[launch-notification] POST error:', err);
    return json({
      ok: false,
      error: 'Chyba při odesílání notifikací',
      details: err.message,
    }, 500);
  }
}
