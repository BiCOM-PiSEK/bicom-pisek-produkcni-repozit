/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Hero bannery (hero_config)
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/hero               — seznam všech hero konfigurací
 * GET  /admin/hero?key=PAGE      — jedna konfigurace
 * PUT  /admin/hero               — upsert konfigurace (dle page_key)
 *
 * Auth: functions/admin/_middleware.js → data.operator.
 * ═══════════════════════════════════════════════════════════════
 */

import { json, auditStmt, invalidateCache, cacheKey } from '../lib/cms.js';
import { stripTags } from '../lib/sanitize.js';

/**
 * Bezpečná URL pro veřejný web: prázdná, relativní cesta („/…"),
 * absolutní https, nebo mailto/tel. Blokuje javascript:/data: apod.
 * @param {string} value
 * @returns {boolean}
 */
function isSafeUrl(value) {
  if (!value) return true; // prázdné je OK
  return /^(\/[^/]|\/$|https:\/\/|mailto:|tel:)/i.test(value);
}

/**
 * GET — seznam hero konfigurací, nebo jedna dle ?key=.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      const row = await env.DB.prepare('SELECT * FROM hero_config WHERE page_key = ?').bind(key).first();
      return json({ ok: true, data: row || null });
    }

    const { results } = await env.DB.prepare('SELECT * FROM hero_config ORDER BY page_key').all();
    return json({ ok: true, data: { heroes: results || [] } });
  } catch (err) {
    console.error('[admin/hero] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání hero banneru.' }, 500);
  }
}

/**
 * PUT — upsert hero konfigurace stránky (validace URL) + audit + cache invalidace.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const page_key = stripTags(body.page_key, 120);
    if (!page_key) return json({ ok: false, error: 'Chybí klíč stránky.' }, 400);
    if (!/^[a-z0-9-]+$/.test(page_key)) {
      return json({ ok: false, error: 'Klíč stránky smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }

    const headline = stripTags(body.headline, 200);
    const subheadline = stripTags(body.subheadline, 400);
    const cta_text = stripTags(body.cta_text, 80);
    const cta_link = stripTags(body.cta_link, 300);
    const background_image_url = stripTags(body.background_image_url, 500);
    const overlay_color = stripTags(body.overlay_color, 50) || 'rgba(0,0,0,0.3)';

    if (!isSafeUrl(cta_link)) {
      return json({ ok: false, error: 'Odkaz tlačítka musí být relativní cesta (např. /book) nebo https adresa.' }, 400);
    }
    if (!isSafeUrl(background_image_url)) {
      return json({ ok: false, error: 'Obrázek pozadí musí být relativní cesta (např. /api/media/…) nebo https adresa.' }, 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM hero_config WHERE page_key = ?').bind(page_key).first();

    if (existing) {
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE hero_config
           SET headline = ?, subheadline = ?, cta_text = ?, cta_link = ?, background_image_url = ?, overlay_color = ?, updated_by = ?, updated_at = datetime('now')
           WHERE page_key = ?`
        ).bind(headline, subheadline, cta_text, cta_link, background_image_url, overlay_color, data.operator.id, page_key),
        auditStmt(env.DB, 'hero_config', existing.id, 'update', data.operator, `Upraven hero banner „${page_key}"`),
      ]);
    } else {
      const id = crypto.randomUUID();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO hero_config (id, page_key, headline, subheadline, cta_text, cta_link, background_image_url, overlay_color, updated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        ).bind(id, page_key, headline, subheadline, cta_text, cta_link, background_image_url, overlay_color, data.operator.id),
        auditStmt(env.DB, 'hero_config', id, 'create', data.operator, `Vytvořen hero banner „${page_key}"`),
      ]);
    }

    await invalidateCache(env, cacheKey.hero(page_key));
    return json({ ok: true, data: { page_key } });
  } catch (err) {
    console.error('[admin/hero] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání hero banneru.' }, 500);
  }
}
