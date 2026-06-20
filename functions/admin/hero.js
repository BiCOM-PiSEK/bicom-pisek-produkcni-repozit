/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Hero bannery (hero_config) — draft/publish (F12)
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/hero                       — seznam (vč. has_draft)
 * GET  /admin/hero?key=PAGE              — detail (živé + draft_json)
 * GET  /admin/hero?key=PAGE&preview=1    — efektivní (draft, jinak živé) pro náhled
 * PUT  /admin/hero                       — uložit změnu jako koncept (draft)
 * POST /admin/hero {action:publish|discard, page_key}
 *
 * Auth: functions/admin/_middleware.js → data.operator.
 * ═══════════════════════════════════════════════════════════════
 */

import { json, auditStmt, invalidateCache, cacheKey } from '../lib/cms.js';
import { stripTags } from '../lib/sanitize.js';

const HERO_FIELDS = ['headline', 'subheadline', 'cta_text', 'cta_link', 'background_image_url', 'overlay_color'];

/**
 * Bezpečná URL pro veřejný web: prázdná, relativní cesta, https, mailto/tel.
 * @param {string} value
 * @returns {boolean}
 */
function isSafeUrl(value) {
  if (!value) return true;
  return /^(\/[^/]|\/$|https:\/\/|mailto:|tel:)/i.test(value);
}

/**
 * Normalizuje a zvaliduje hero pole z těla požadavku. Vrací {hero}|{error}.
 * Pole, která tělo neobsahuje (undefined), se nepřepisují prázdnou hodnotou,
 * ale dědí z živé verze (existing) — aby se částečný PUT nezahodil zbytek.
 */
function prepareHero(body, existing) {
  const e = existing || {};
  const hero = {
    headline: body.headline != null ? stripTags(body.headline, 200) : (e.headline || ''),
    subheadline: body.subheadline != null ? stripTags(body.subheadline, 400) : (e.subheadline || ''),
    cta_text: body.cta_text != null ? stripTags(body.cta_text, 80) : (e.cta_text || ''),
    cta_link: body.cta_link != null ? stripTags(body.cta_link, 300) : (e.cta_link || ''),
    background_image_url: body.background_image_url != null ? stripTags(body.background_image_url, 500) : (e.background_image_url || ''),
    overlay_color: body.overlay_color != null ? (stripTags(body.overlay_color, 50) || 'rgba(0,0,0,0.3)') : (e.overlay_color || 'rgba(0,0,0,0.3)'),
  };
  if (!isSafeUrl(hero.cta_link)) return { error: 'Odkaz tlačítka musí být relativní cesta (např. /book) nebo https adresa.' };
  if (!isSafeUrl(hero.background_image_url)) return { error: 'Obrázek pozadí musí být relativní cesta (např. /api/media/…) nebo https adresa.' };
  return { hero };
}

/** Sloučí živá pole s draft_json (pro náhled). */
function effectiveHero(row) {
  const base = {};
  for (const f of HERO_FIELDS) base[f] = row[f] ?? '';
  if (row.has_draft && row.draft_json) {
    try { Object.assign(base, JSON.parse(row.draft_json)); } catch { /* ignore */ }
  }
  base.page_key = row.page_key;
  return base;
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      const row = await env.DB.prepare('SELECT * FROM hero_config WHERE page_key = ?').bind(key).first();
      if (!row) return json({ ok: true, data: null });
      if (url.searchParams.get('preview')) {
        return json({ ok: true, data: effectiveHero(row) });
      }
      return json({ ok: true, data: row });
    }

    const { results } = await env.DB.prepare(
      'SELECT page_key, headline, has_draft, updated_at FROM hero_config ORDER BY page_key'
    ).all();
    return json({ ok: true, data: { heroes: results || [] } });
  } catch (err) {
    console.error('[admin/hero] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání hero banneru.' }, 500);
  }
}

/** PUT — uloží změnu jako koncept (draft_json). Živý banner se nemění. */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const page_key = stripTags(body.page_key, 120);
    if (!page_key) return json({ ok: false, error: 'Chybí klíč stránky.' }, 400);
    if (!/^[a-z0-9-]+$/.test(page_key)) {
      return json({ ok: false, error: 'Klíč stránky smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }
    const existing = await env.DB.prepare('SELECT * FROM hero_config WHERE page_key = ?').bind(page_key).first();
    const prep = prepareHero(body, existing);
    if (prep.error) return json({ ok: false, error: prep.error }, 400);
    const draftJson = JSON.stringify(prep.hero);

    if (existing) {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE hero_config SET draft_json = ?, has_draft = 1, updated_by = ?, updated_at = datetime('now') WHERE page_key = ?`
        ).bind(draftJson, data.operator.id, page_key),
        auditStmt(env.DB, 'hero_config', existing.id, 'update', data.operator, `Uložen koncept hero „${page_key}"`),
      ]);
    } else {
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO hero_config (id, page_key, overlay_color, draft_json, has_draft, updated_by, updated_at)
           VALUES (?, ?, 'rgba(0,0,0,0.3)', ?, 1, ?, datetime('now'))`
        ).bind(id, page_key, draftJson, data.operator.id),
        auditStmt(env.DB, 'hero_config', id, 'create', data.operator, `Vytvořen koncept hero „${page_key}"`),
      ]);
    }
    return json({ ok: true, data: { page_key, has_draft: 1 } });
  } catch (err) {
    console.error('[admin/hero] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání konceptu.' }, 500);
  }
}

/** POST — publish/discard konceptu hero banneru. */
export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const action = body.action;
    if (action !== 'publish' && action !== 'discard') {
      return json({ ok: false, error: 'Neznámá akce.' }, 400);
    }
    const page_key = stripTags(body.page_key, 120);
    const row = await env.DB.prepare('SELECT * FROM hero_config WHERE page_key = ?').bind(page_key).first();
    if (!row) return json({ ok: false, error: 'Hero nenalezen.' }, 404);
    if (!row.has_draft) return json({ ok: false, error: 'Žádný koncept.' }, 409);

    if (action === 'discard') {
      await env.DB.batch([
        env.DB.prepare(`UPDATE hero_config SET draft_json = NULL, has_draft = 0 WHERE page_key = ?`).bind(page_key),
        auditStmt(env.DB, 'hero_config', row.id, 'update', data.operator, `Zahozen koncept hero „${page_key}"`),
      ]);
      return json({ ok: true, data: { page_key, discarded: true } });
    }

    // publish — aplikuj draft_json na živá pole
    let d;
    try { d = JSON.parse(row.draft_json); } catch { d = {}; }
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE hero_config
         SET headline = ?, subheadline = ?, cta_text = ?, cta_link = ?, background_image_url = ?, overlay_color = ?,
             draft_json = NULL, has_draft = 0, updated_by = ?, updated_at = datetime('now')
         WHERE page_key = ?`
      ).bind(
        d.headline ?? row.headline, d.subheadline ?? row.subheadline, d.cta_text ?? row.cta_text,
        d.cta_link ?? row.cta_link, d.background_image_url ?? row.background_image_url,
        d.overlay_color ?? row.overlay_color, data.operator.id, page_key
      ),
      auditStmt(env.DB, 'hero_config', row.id, 'update', data.operator, `Zveřejněn hero „${page_key}"`),
    ]);
    await invalidateCache(env, cacheKey.hero(page_key));
    return json({ ok: true, data: { page_key, published: true } });
  } catch (err) {
    console.error('[admin/hero] POST error:', err);
    return json({ ok: false, error: 'Chyba při zpracování konceptu.' }, 500);
  }
}
