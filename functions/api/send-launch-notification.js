/**
 * POST /api/send-launch-notification
 * Sends v1.0 Preview Launch notification emails to stakeholders.
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const RECIPIENTS = [
  { email: 'jiri.limpouch@alettgroup.cz', name: 'Jiri Limpouch' },
  { email: 'matej.kocanda@icloud.com', name: 'Matej Kocanda' },
  { email: 'admin@bicom-pisek.cz', name: 'BiCOM Admin' },
];

const SUBJECT = 'Bicom Pisek Virtual Office - v1.0 PREVIEW LAUNCH (od zitrka, 1.7.2026)';

const HTML_BODY = `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"><title>Bicom Pisek v1.0 Launch</title></head>
<body style="font-family:Arial,sans-serif;color:#2B2B2B;line-height:1.6;max-width:700px;margin:0 auto;padding:20px;">
  <div style="background:#3A4A3C;padding:24px;border-radius:8px;margin-bottom:24px;text-align:center;">
    <h1 style="color:#FFF;margin:0;font-size:24px;">Bicom Pisek</h1>
    <p style="color:#E8D5B8;margin:4px 0 0;font-size:13px;">Virtual Office v1.0 PREVIEW LAUNCH</p>
  </div>
  <h2 style="color:#3A4A3C;">Vitejte v novem era ordinace!</h2>
  <p>S potesenim vas informujeme, ze <strong>Bicom Pisek - Virtual Office v1.0</strong> vstupuje do <strong>PREVIEW rezimu od zitrka (23.6.2026)</strong> na produkcni domene <strong>bicom-pisek.cz</strong>.</p>
  <div style="background:#EFF6EF;padding:16px;border-radius:8px;border-left:4px solid #5A8A5C;margin:16px 0;">
    <strong>Status:</strong> Web je v preview rezimu - vsechny funkce budou dostupne od <strong>1. cervence 2026</strong>.
  </div>
  <h3 style="color:#3A4A3C;">CO JE HOTOVO (V1.0)</h3>
  <ul>
    <li>Verejny web - galerie, blog, AI Radce, rezervace</li>
    <li>Admin konzole - sprava rezervaci, obsahu, galerii, emailu</li>
    <li>CMS - draft/publish workflow bez redeploymentu</li>
    <li>Google Calendar - synchronizace terminu</li>
    <li>Email + SMS - notifikace (Resend + GoSMS)</li>
    <li>AI Chatbot - Llama-3-8b kontextove vedomy asistent</li>
    <li>Bezpecnost - Zero Trust (Cloudflare Access), GDPR</li>
  </ul>
  <h3 style="color:#3A4A3C;">CO CHYBI (Do 1.7)</h3>
  <ul>
    <li>Stripe payment - online platba kartou</li>
    <li>iDoklad API - automaticke fakturovani</li>
    <li>Meta Graph API - Instagram sync (app review pending)</li>
  </ul>
  <h3 style="color:#3A4A3C;">ADMIN KONZOLE</h3>
  <p><strong>URL:</strong> <a href="https://bicom-pisek.cz/admin">https://bicom-pisek.cz/admin</a></p>
  <p><strong>Pristup:</strong> Cloudflare Access - jednorazovy PIN na e-mail</p>
  <h3 style="color:#3A4A3C;">TIMELINE</h3>
  <p>22.-23.6.: Merge na produkci + Preview mode ON<br>25.-30.6.: Testing sprint<br>1.7.: FULL RELEASE v1.0</p>
  <h3 style="color:#3A4A3C;">SUPPORT</h3>
  <p>support@meverik.studio</p>
  <hr style="margin:32px 0;border:none;border-top:1px solid #EEE;">
  <p style="font-size:12px;color:#999;text-align:center;">
    Bicom Pisek - Virtual Office v1.0<br>
    Vyvijeno: Meverik Studio + Agenticka divize MK94<br>
    Odesla: MEVERIK v1 - Personal AI Assistant na zaklade komunikace Mateje Kocandy
  </p>
</body>
</html>`;

export async function onRequestPost({ env }) {
  const apiKey = env.SECRET_RESEND_API_KEY;
  if (!apiKey) {
    return json({ ok: false, error: 'SECRET_RESEND_API_KEY not configured' }, 500);
  }

  const results = [];

  for (const recipient of RECIPIENTS) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Bicom Pisek <noreply@bicom-pisek.cz>',
          to: [recipient.email],
          subject: SUBJECT,
          html: HTML_BODY,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        results.push({ email: recipient.email, status: 'sent', id: data.id });
      } else {
        results.push({ email: recipient.email, status: 'failed', error: data.message || JSON.stringify(data) });
      }
    } catch (err) {
      results.push({ email: recipient.email, status: 'error', error: err.message });
    }
  }

  const sent = results.filter(r => r.status === 'sent').length;

  return json({
    ok: true,
    campaign_id: 'LAUNCH-v1.0-22062026',
    timestamp: new Date().toISOString(),
    summary: { total: RECIPIENTS.length, sent, failed: RECIPIENTS.length - sent },
    results,
  }, 201);
}
