/**
 * Visual Builder Announcement — one-shot notification
 * POST /api/send-vb-announcement
 * Sends Visual Builder deployment announcement to info@bicompisek.cz
 * and admin@bicom-pisek.cz.
 */

import { ResendConnector } from '../lib/connectors/resend.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const RECIPIENTS = [
  { email: 'info@bicompisek.cz', name: 'BiCOM Písek — ordinace' },
  { email: 'admin@bicom-pisek.cz', name: 'BiCOM Admin' },
];

const SUBJECT = '✅ Visual Builder nasazen — přístupy uděleny | BiCOM Písek';

const GUIDE_SUMMARY = `
<div style="background:#EFF6EF;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #5A8A5C">
  <h3 style="color:#3A4A3C;margin:0 0 12px;font-size:15px">📋 Jak pracovat s Visual Builderem</h3>
  <ol style="margin:0;padding-left:20px;color:#2B2B2B;font-size:13px">
    <li style="margin-bottom:6px"><strong>Vyber blok</strong> — klikni na prvek v náhledu nebo v seznamu bloků</li>
    <li style="margin-bottom:6px"><strong>Uprav obsah</strong> — edituj v pravém inspektoru</li>
    <li style="margin-bottom:6px"><strong>Ulož koncept</strong> — změna se ještě nepropíše na veřejný web</li>
    <li style="margin-bottom:6px"><strong>Zkontroluj náhled</strong> — ověř vizuální výsledek</li>
    <li><strong>Zveřejni</strong> — teprve pak se změna projeví na bicom-pisek.cz</li>
  </ol>
</div>
<div style="background:#FDF8ED;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #D4A843;font-size:13px">
  <strong style="display:block;margin-bottom:4px;color:#3A4A3C">⚠️ Uložit ≠ Zveřejnit</strong>
  Každá změna prochází draft fází. Veřejný web se aktualizuje až po kliknutí na <em>Zveřejnit</em>.
</div>
`;

const HTML_BODY = `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family:'Montserrat',Arial,sans-serif;color:#2B2B2B;line-height:1.7;max-width:700px;margin:0 auto;background:#F7F5F2;padding:20px;">
  <div style="background:#FFFFFF;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden">

    <div style="background:linear-gradient(135deg,#3A4A3C 0%,#627562 100%);padding:40px 36px;text-align:center">
      <h1 style="color:#FFFFFF;margin:0 0 8px;font-size:30px;font-family:Georgia,serif;font-weight:300;letter-spacing:2px">Bicom Písek</h1>
      <p style="color:#E8D5B8;margin:0;font-size:13px;letter-spacing:1.5px;text-transform:uppercase">Visual Builder — nasazen do produkce</p>
    </div>

    <div style="padding:32px 36px">

      <h2 style="color:#3A4A3C;font-family:Georgia,serif;font-size:20px;font-weight:400;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #738A75">
        ✅ Visual Builder je připraven k použití
      </h2>

      <p>Vážení,</p>
      <p>s potěšením oznamujeme, že <strong>Visual Builder</strong> byl úspěšně nasazen do produkčního prostředí webu <strong>BiCOM Písek</strong>.</p>

      <div style="background:#F0EBE3;padding:20px;border-radius:10px;margin:20px 0">
        <h3 style="color:#3A4A3C;margin:0 0 12px;font-size:15px">🔑 Stav přístupů</h3>
        <ul style="margin:0;padding-left:20px;color:#2B2B2B;font-size:13px">
          <li style="margin-bottom:8px">✅ Oprávnění udělena pro <strong>admin role</strong></li>
          <li style="margin-bottom:8px">✅ Přístup funkční pro oprávněné uživatele <strong>mimo budovu Technologického Parku Písek</strong> (sídlo ordinace)</li>
          <li>✅ Zabezpečení zajišťuje Cloudflare Access (OTP přihlašování)</li>
        </ul>
      </div>

      ${GUIDE_SUMMARY}

      <h3 style="color:#3A4A3C;font-size:15px;margin:24px 0 12px">📌 Typy bloků v systému</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <tr style="background:#3A4A3C;color:#fff">
          <th style="padding:8px 12px;text-align:left">Typ</th>
          <th style="padding:8px 12px;text-align:left">Popis</th>
        </tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #EEE">✏️ Editovatelné</td><td style="padding:8px 12px;border-bottom:1px solid #EEE">Texty, nadpisy, FAQ, kontakty — lze měnit přímo</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #EEE">🖼️ Média</td><td style="padding:8px 12px;border-bottom:1px solid #EEE">Obrázky, hero, galerie — výměna přes mediatéku</td></tr>
        <tr><td style="padding:8px 12px;border-bottom:1px solid #EEE">⚡ Dynamické</td><td style="padding:8px 12px;border-bottom:1px solid #EEE">Rezervační formulář, AI Rádce — generováno automaticky</td></tr>
        <tr><td style="padding:8px 12px">🔒 Zamčené</td><td style="padding:8px 12px">Strukturální části šablony — jen technický zásah</td></tr>
      </table>

      <div style="background:#EDF3F8;padding:20px;border-radius:8px;margin:20px 0">
        <h3 style="color:#3A4A3C;margin:0 0 12px;font-size:15px">🤖 Připravuje se: Visual Builder Agent</h3>
        <p style="margin:0;font-size:13px">V rámci <strong>MEVERIK PRIME — škálovací servis</strong> bude dostupný <em>Visual Builder Agent</em>: místo klikání v rozhraní bude možné zadávat změny konverzačně přes AI agenta.</p>
      </div>

      <h3 style="color:#3A4A3C;font-size:15px;margin:24px 0 12px">🆘 Podpora a incidenty</h3>
      <ul style="font-size:13px;margin:0;padding-left:20px">
        <li style="margin-bottom:8px"><strong>MEVERIK SOLUTION Services</strong> — provozní podpora</li>
        <li style="margin-bottom:8px">📧 Matěj Kocanda: <a href="mailto:matej@meverik.xyz" style="color:#5A8A5C">matej@meverik.xyz</a></li>
        <li>📞 Urgentní: +420 777 797 330</li>
      </ul>

      <div style="margin:28px 0 16px">
        <a href="https://bicom-pisek.cz/admin" style="display:inline-block;background:#3A4A3C;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;letter-spacing:0.5px">
          Otevřít administraci →
        </a>
      </div>

      <p style="font-size:12px;color:#8A7E72;margin-top:4px">
        Produkční PR nasazení: <a href="https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit/pull/102" style="color:#5A8A5C">GitHub PR #102</a>
      </p>

    </div><!-- /inner -->

    <div style="background:#3A4A3C;color:#E8D5B8;padding:24px 36px;text-align:center;font-size:11px;line-height:1.9">
      <div style="font-family:Georgia,serif;font-size:18px;color:#fff;letter-spacing:2px;margin-bottom:4px">BiCOM Písek</div>
      MEVERIK STUDIO &nbsp;•&nbsp; Interní přidělení: MEVERIK SOLUTION<br>
      Autor řešení: MEVERIK PRIME — Matěj Kocanda<br>
      <em style="color:#A8B8A8">Vize a vytrvalost &nbsp;|&nbsp; Tvořit. Myslet. Vytrvat.</em>
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

    const successful = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    if (env.DB) {
      try {
        await env.DB.prepare(
          `INSERT INTO audit_log (action, actor, target, details, timestamp)
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
          'send_vb_announcement',
          'system',
          'visual_builder_deployment',
          JSON.stringify({ total_sent: RECIPIENTS.length, successful, failed, results })
        ).run();
      } catch {}
    }

    return json({
      ok: true,
      campaign: 'VB-ANNOUNCEMENT-v1.0',
      timestamp: new Date().toISOString(),
      summary: { total: RECIPIENTS.length, sent: successful, failed },
      results,
      message: `Visual Builder oznámení odesláno: ${successful}/${RECIPIENTS.length}`,
    }, 201);
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}