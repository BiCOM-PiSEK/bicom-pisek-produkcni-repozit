// POST /api/book — referenční implementace (vzor pro agenty).
// Tok: validace -> šifrování -> D1 insert -> enqueue (Calendar+e-mail+reminder).
import { DataCrypt } from '../lib/crypto.js';

const CORS = {
  'Access-Control-Allow-Origin': 'https://bicompisek.cz',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

const PSC_RE = /^\d{3}\s?\d{2}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function onRequestOptions() { return new Response(null, { headers: CORS }); }

export async function onRequestPost({ request, env }) {
  try {
    const d = await request.json();

    // 1) validace + sanitizace
    if (!d.name || !EMAIL_RE.test(d.email || '') || !d.phone || !d.service || !d.preferred_date)
      return json({ ok: false, error: 'Neúplné nebo neplatné údaje.' }, 400);
    if (d.consent !== true)
      return json({ ok: false, error: 'Chybí souhlas se zpracováním (čl. 9 GDPR).' }, 400);

    // 2) rate limit (KV) — max 3 poptávky / 10 min / IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rlKey = `rl:book:${ip}`;
    const cnt = parseInt(await env.CACHE.get(rlKey) || '0', 10);
    if (cnt >= 3) return json({ ok: false, error: 'Příliš mnoho pokusů, zkuste později.' }, 429);
    await env.CACHE.put(rlKey, String(cnt + 1), { expirationTtl: 600 });

    // 3) šifrování citlivých polí
    const KEY = env.ENCRYPTION_KEY;
    const id = crypto.randomUUID();
    const rec = {
      id,
      name_enc: await DataCrypt.encryptText(String(d.name).slice(0, 120), KEY),
      email_enc: await DataCrypt.encryptText(String(d.email).slice(0, 160), KEY),
      phone_enc: await DataCrypt.encryptText(String(d.phone).slice(0, 40), KEY),
      note_enc: await DataCrypt.encryptText(String(d.note || '').slice(0, 2000), KEY),
      service: String(d.service).slice(0, 80),
      preferred_date: String(d.preferred_date).slice(0, 30),
      psc: PSC_RE.test(d.psc || '') ? String(d.psc).replace(/\s/g, '') : null,
      consent_version: String(d.consent_version || 'v1')
    };

    // 4) zápis do D1 (parametrizovaně — žádná SQLi)
    await env.DB.prepare(
      `INSERT INTO bookings (id,name_enc,email_enc,phone_enc,note_enc,service,preferred_date,psc,status,consent_version)
       VALUES (?,?,?,?,?,?,?,?, 'pending', ?)`
    ).bind(rec.id, rec.name_enc, rec.email_enc, rec.phone_enc, rec.note_enc,
           rec.service, rec.preferred_date, rec.psc, rec.consent_version).run();

    // 5) geo lead (anonymní) + audit
    if (rec.psc) {
      await env.DB.prepare(`INSERT INTO geo_leads (id,psc,service,source) VALUES (?,?,?, 'web')`)
        .bind(crypto.randomUUID(), rec.psc, rec.service).run();
    }
    await env.DB.prepare(`INSERT INTO audit_log (id,entity,entity_id,action,actor) VALUES (?, 'bookings', ?, 'create', 'system')`)
      .bind(crypto.randomUUID(), id).run();

    // 6) async: Calendar + e-mail + reminder (neblokuje odpověď)
    await env.BOOKING_QUEUE.send({ bookingId: id, email: d.email, name: d.name,
      service: rec.service, date: rec.preferred_date });

    return json({ ok: true, id });
  } catch (e) {
    // log do Sentry/audit; klientovi neúniká detail
    return json({ ok: false, error: 'Interní chyba, zkuste to prosím znovu.' }, 500);
  }
}
