/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Newsletter Export Admin API
 * ═══════════════════════════════════════════════════════════════
 * GET /admin/newsletter — Exportuje odběratele newsletteru do CSV
 * ═══════════════════════════════════════════════════════════════
 */

import { DataCrypt } from '../lib/datacrypt.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env, data }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    // Načtení aktivních odběratelů
    const { results } = await env.DB.prepare(
      `SELECT email_enc, source, created_at
       FROM newsletter_subscribers
       WHERE status = 'active'
       ORDER BY created_at DESC`
    ).all();

    if (!results || results.length === 0) {
      // Pokud nejsou odběratelé, vrátíme prázdné CSV s hlavičkou
      const csvContent = 'Email,Zdroj,Datum prihlaseni\n';
      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="newsletter_subscribers.csv"',
        },
      });
    }

    const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
    let csvRows = ['Email,Zdroj,Datum prihlaseni'];

    for (const row of results) {
      let email = '(šifrováno)';
      try {
        email = await crypt.decrypt(row.email_enc);
      } catch (e) {
        console.warn('[admin/newsletter] Failed to decrypt email:', e.message);
      }
      
      // Escape CSV values to prevent injection
      const escapedEmail = email.replace(/"/g, '""');
      const escapedSource = (row.source || '').replace(/"/g, '""');
      
      csvRows.push(`"${escapedEmail}","${escapedSource}","${row.created_at}"`);
    }

    const csvContent = csvRows.join('\n');

    // Zápis do audit logu (export kontaktů)
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'newsletter_subscribers', NULL, 'export', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `operator:${data.operator.id}`,
      `Exportováno ${results.length} odběratelů newsletteru do CSV`
    ).run();

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="newsletter_subscribers.csv"',
      },
    });

  } catch (err) {
    console.error('[admin/newsletter] Export error:', err);
    return json({ ok: false, error: 'Chyba při exportu kontaktů.' }, 500);
  }
}
