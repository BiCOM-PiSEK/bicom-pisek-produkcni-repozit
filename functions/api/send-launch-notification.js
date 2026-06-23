/**
 * LAUNCH NOTIFICATION — Send API
 * POST /api/send-launch-notification
 * One-time stakeholder notification sender.
 */

import { ResendConnector } from '../lib/connectors/resend.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const RECIPIENTS = [
  { email: 'jiri.limpouch@alettgroup.cz', name: 'Jiří Limpouch', role: 'admin' },
  { email: 'matej.kocanda@icloud.com', name: 'Matěj Kočanda', role: 'owner' },
  { email: 'admin@bicom-pisek.cz', name: 'BiCOM Admin', role: 'admin' },
];

const SUBJECT = '🚀 Bicom Písek Virtual Office — v1.0 PREVIEW LAUNCH (od zítřka, 1.7.2026)';

const HTML_BODY = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="color:#2B2B2B;line-height:1.6;max-width:700px;margin:0 auto;background:#F5F5F5;padding:20px;">
  <div style="background:#FFFFFF;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#3A4A3C 0%,#627562 100%);padding:32px;border-radius:12px;margin-bottom:32px;text-align:center;">
      <h1 style="color:#FFFFFF;margin:0 0 8px;font-size:28px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;letter-spacing:1px;">Bicom Písek</h1>
      <p style="color:#E8D5B8;margin:0;font-size:13px;font-weight:300;">Virtual Office — Administrační konzole</p>
    </div>
    <h2 style="color:#3A4A3C;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:400;margin-top:28px;margin-bottom:16px;border-bottom:2px solid #738A75;padding-bottom:8px;">🚀 Vítejte v nové éře ordinace!</h2>
    <p>S potěšením vás informujeme, že <strong>Bicom Písek — Virtual Office v1.0</strong> vstupuje do <strong>PREVIEW režimu od zítřka</strong> na produkční doméně <strong>bicom-pisek.cz</strong>.</p>
    <div style="background:#EFF6EF;padding:16px;border-radius:8px;margin-bottom:16px;">
      <strong>📋 Status:</strong> Web je v preview režimu — všechny funkce budou dostupné od <strong>1. července</strong>.
    </div>
    <h3 style="color:#3A4A3C;font-size:16px;margin-top:24px;margin-bottom:12px;">✅ CO JE HOTOVO (V1.0)</h3>
    <ul style="margin:0;padding-left:20px;color:#2B2B2B;">
      <li style="margin-bottom:8px;">Veřejný web — galerie, blog, AI Rádce, rezervace (bez platby)</li>
      <li style="margin-bottom:8px;">Admin konzole — správa rezervací, obsahu, galerií, e-mailů</li>
      <li style="margin-bottom:8px;">CMS — draft/publish workflow bez redeploymentu</li>
      <li style="margin-bottom:8px;">Google Calendar & Workspace — synchronizace termínů</li>
      <li style="margin-bottom:8px;">Email + SMS notifikace</li>
      <li style="margin-bottom:8px;">AI Chatbot</li>
      <li>Bezpečnost — Cloudflare Access, GDPR</li>
    </ul>
    <div style="margin-top:36px;padding-top:20px;border-top:1px solid #E8E8E8;text-align:center;font-size:12px;color:#999;">
      <p style="margin:8px 0;">
        <strong>Bicom Písek — Virtual Office v1.0</strong><br>
        Vyvíjeno: Meverik Studio + Agentická divize MK94<br>
        Odesláno: MEVERIK v1 — Personal AI Assistant
      </p>
    </div>
  </div>
</body>
</html>
`.trim();

export async function onRequestPost({ env }) {
  try {
    const resend = new ResendConnector(env);
    const results = [];

    for (const recipient of RECIPIENTS) {
      try {
        const emailResult = await resend.sendEmail(recipient.email, SUBJECT, HTML_BODY);
        results.push({
          email: recipient.email,
          name: recipient.name,
          status: emailResult ? 'sent' : 'failed',
          message_id: emailResult?.id || null,
        });
      } catch (err) {
        results.push({
          email: recipient.email,
          name: recipient.name,
          status: 'error',
          error: err.message,
        });
      }
    }

    const successful = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status !== 'sent').length;

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
            total_sent: RECIPIENTS.length,
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
        total: RECIPIENTS.length,
        sent: successful,
        failed,
      },
      results,
      message: `Notifikace odeslány: ${successful}/${RECIPIENTS.length} úspěšně`,
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
