/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Služby / programy (services) — draft/publish (F12-F2)
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/services                  — seznam (vč. has_draft)
 * GET  /admin/services?slug=SLUG        — detail (živé + draft_json)
 * GET  /admin/services?preview=1        — efektivní seznam (draft-merge) pro náhled
 * POST /admin/services                  — vytvořit službu (rovnou živou)
 * POST /admin/services {action:publish|discard, slug}
 * PUT  /admin/services                  — uložit změnu jako koncept (draft_json)
 * DELETE /admin/services?slug=SLUG      — smazat službu
 *
 * Veřejné /api/services vrací jen živé sloupce (bez draft). Auth: _middleware.
 * ═══════════════════════════════════════════════════════════════
 */

import { json, auditStmt, invalidateServicesCache } from '../lib/cms.js';
import { sanitizeHTML, stripTags } from '../lib/sanitize.js';

const CATEGORIES = ['imunita', 'energie', 'bolest', 'psychika', 'hormony', 'metabolismus', 'organy', 'patogeny', 'prostredi', 'onkologie', 'prevence'];
const SEGMENTS = ['zeny', 'deti', 'profesionalove', 'biohackeri', 'vsichni'];
const EDITABLE = ['name', 'category', 'segment', 'short_desc', 'long_desc', 'price_avg', 'price_note', 'sessions_typ', 'icon_url', 'sort_order', 'active'];

/** Bezpečná URL (relativní/https). @param {string} v @returns {boolean} */
function isSafeUrl(v) {
  if (!v) return true;
  return /^(\/[^/]|\/$|https:\/\/)/i.test(v);
}

/** Normalizuje a zvaliduje pole služby z těla. Vrací {svc}|{error}. */
function prepareService(body, existing) {
  const e = existing || {};
  const name = body.name != null ? stripTags(body.name, 200) : e.name;
  if (!name) return { error: 'Název služby je povinný.' };
  const category = body.category != null ? body.category : e.category;
  if (category && !CATEGORIES.includes(category)) return { error: 'Neplatná kategorie.' };
  const segment = body.segment != null ? body.segment : (e.segment || 'vsichni');
  if (!SEGMENTS.includes(segment)) return { error: 'Neplatný segment.' };
  const icon_url = body.icon_url != null ? stripTags(body.icon_url, 500) : e.icon_url;
  if (!isSafeUrl(icon_url)) return { error: 'Ikona musí být relativní cesta nebo https adresa.' };
  const price = body.price_avg != null ? parseInt(body.price_avg, 10) : e.price_avg;
  if (body.price_avg != null && (isNaN(price) || price < 0)) return { error: 'Cena musí být kladné číslo.' };
  return {
    svc: {
      name,
      category: category || null,
      segment,
      short_desc: body.short_desc != null ? sanitizeHTML(body.short_desc, 1000) : (e.short_desc || ''),
      long_desc: body.long_desc != null ? sanitizeHTML(body.long_desc, 5000) : (e.long_desc || ''),
      price_avg: price ?? null,
      price_note: body.price_note != null ? stripTags(body.price_note, 200) : (e.price_note || ''),
      sessions_typ: body.sessions_typ != null ? stripTags(body.sessions_typ, 100) : (e.sessions_typ || ''),
      icon_url: icon_url || null,
      sort_order: body.sort_order != null ? (parseInt(body.sort_order, 10) || 0) : (e.sort_order || 0),
      active: body.active != null ? (body.active ? 1 : 0) : (e.active != null ? e.active : 1),
    },
  };
}

/** Sloučí živá pole s draft_json (pro náhled / editaci). */
function effective(row) {
  const out = { ...row };
  if (row.has_draft && row.draft_json) {
    try { Object.assign(out, JSON.parse(row.draft_json)); } catch { /* ignore */ }
  }
  delete out.draft_json;
  return out;
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');

    if (url.searchParams.get('preview')) {
      const { results } = await env.DB.prepare('SELECT * FROM services ORDER BY sort_order').all();
      const list = (results || []).filter((r) => effective(r).active).map((r) => {
        const e = effective(r);
        return { slug: r.slug, name: e.name, category: e.category, short_desc: e.short_desc, long_desc: e.long_desc, price_avg: e.price_avg, price_note: e.price_note, sessions_typ: e.sessions_typ, icon_url: e.icon_url, sort_order: e.sort_order };
      });
      return json({ ok: true, data: { services: list } });
    }

    if (slug) {
      const row = await env.DB.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first();
      if (!row) return json({ ok: false, error: 'Služba nenalezena.' }, 404);
      return json({ ok: true, data: row });
    }

    const { results } = await env.DB.prepare(
      'SELECT slug, name, category, price_avg, active, sort_order, has_draft FROM services ORDER BY sort_order'
    ).all();
    return json({ ok: true, data: { services: results || [] } });
  } catch (err) {
    console.error('[admin/services] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání služeb.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const body = await request.json();

    if (body.action === 'publish' || body.action === 'discard') {
      return handleDraftAction(env, data, body.slug, body.action);
    }

    // Vytvoření nové služby (rovnou živá)
    const slug = stripTags(body.slug, 120);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return json({ ok: false, error: 'Slug smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }
    const prep = prepareService(body, null);
    if (prep.error) return json({ ok: false, error: prep.error }, 400);
    const existing = await env.DB.prepare('SELECT slug FROM services WHERE slug = ?').bind(slug).first();
    if (existing) return json({ ok: false, error: 'Služba s tímto slugem už existuje.' }, 409);

    const s = prep.svc;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO services (slug, name, category, segment, short_desc, long_desc, price_avg, price_note, sessions_typ, icon_url, active, sort_order, updated_at, has_draft)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`
      ).bind(slug, s.name, s.category, s.segment, s.short_desc, s.long_desc, s.price_avg, s.price_note, s.sessions_typ, s.icon_url, s.active, s.sort_order),
      auditStmt(env.DB, 'services', slug, 'create', data.operator, `Vytvořena služba „${slug}"`),
    ]);
    await invalidateServicesCache(env);
    return json({ ok: true, data: { slug } }, 201);
  } catch (err) {
    console.error('[admin/services] POST error:', err);
    return json({ ok: false, error: 'Chyba při zpracování požadavku.' }, 500);
  }
}

/** PUT — uloží změnu služby jako koncept (draft_json). */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const body = await request.json();
    const slug = stripTags(body.slug, 120);
    if (!slug) return json({ ok: false, error: 'Chybí slug.' }, 400);
    const existing = await env.DB.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first();
    if (!existing) return json({ ok: false, error: 'Služba nenalezena.' }, 404);
    const prep = prepareService(body, existing);
    if (prep.error) return json({ ok: false, error: prep.error }, 400);

    await env.DB.batch([
      env.DB.prepare(`UPDATE services SET draft_json = ?, has_draft = 1, updated_at = datetime('now') WHERE slug = ?`)
        .bind(JSON.stringify(prep.svc), slug),
      auditStmt(env.DB, 'services', slug, 'update', data.operator, `Uložen koncept služby „${slug}"`),
    ]);
    return json({ ok: true, data: { slug, has_draft: 1 } });
  } catch (err) {
    console.error('[admin/services] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání konceptu.' }, 500);
  }
}

export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return json({ ok: false, error: 'Chybí slug.' }, 400);
    const existing = await env.DB.prepare('SELECT slug FROM services WHERE slug = ?').bind(slug).first();
    if (!existing) return json({ ok: false, error: 'Služba nenalezena.' }, 404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM services WHERE slug = ?').bind(slug),
      auditStmt(env.DB, 'services', slug, 'delete', data.operator, `Smazána služba „${slug}"`),
    ]);
    await invalidateServicesCache(env);
    return json({ ok: true, data: { slug } });
  } catch (err) {
    console.error('[admin/services] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání služby.' }, 500);
  }
}

/**
 * Publish/discard konceptu služby.
 * @param {Object} env @param {Object} data @param {string} slugRaw @param {'publish'|'discard'} action
 * @returns {Promise<Response>}
 */
async function handleDraftAction(env, data, slugRaw, action) {
  const slug = stripTags(slugRaw, 120);
  const row = await env.DB.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first();
  if (!row) return json({ ok: false, error: 'Služba nenalezena.' }, 404);
  if (!row.has_draft) return json({ ok: false, error: 'Žádný koncept.' }, 409);

  if (action === 'discard') {
    await env.DB.batch([
      env.DB.prepare('UPDATE services SET draft_json = NULL, has_draft = 0 WHERE slug = ?').bind(slug),
      auditStmt(env.DB, 'services', slug, 'update', data.operator, `Zahozen koncept služby „${slug}"`),
    ]);
    return json({ ok: true, data: { slug, discarded: true } });
  }

  let d;
  try { d = JSON.parse(row.draft_json); } catch { d = {}; }
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE services SET name = ?, category = ?, segment = ?, short_desc = ?, long_desc = ?,
              price_avg = ?, price_note = ?, sessions_typ = ?, icon_url = ?, sort_order = ?, active = ?,
              draft_json = NULL, has_draft = 0, updated_at = datetime('now')
       WHERE slug = ?`
    ).bind(
      d.name ?? row.name, d.category ?? row.category, d.segment ?? row.segment,
      d.short_desc ?? row.short_desc, d.long_desc ?? row.long_desc, d.price_avg ?? row.price_avg,
      d.price_note ?? row.price_note, d.sessions_typ ?? row.sessions_typ, d.icon_url ?? row.icon_url,
      d.sort_order ?? row.sort_order, d.active ?? row.active, slug
    ),
    auditStmt(env.DB, 'services', slug, 'update', data.operator, `Zveřejněna služba „${slug}"`),
  ]);
  await invalidateServicesCache(env);
  return json({ ok: true, data: { slug, published: true } });
}
