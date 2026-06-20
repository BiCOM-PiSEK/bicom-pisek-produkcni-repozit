/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Textové sekce webu (content_blocks)
 * ═══════════════════════════════════════════════════════════════
 * GET    /admin/content                 — seznam všech sekcí
 * GET    /admin/content?key=KEY         — jedna sekce
 * GET    /admin/content?history=1       — audit historie CMS změn
 * POST   /admin/content                 — vytvořit sekci
 * PUT    /admin/content                 — upravit sekci (dle section_key)
 * DELETE /admin/content?key=KEY         — smazat sekci
 *
 * Auth: zajišťuje functions/admin/_middleware.js → data.operator.
 * ═══════════════════════════════════════════════════════════════
 */

import { sanitizeHTML, stripTags } from '../lib/sanitize.js';
import { json, auditStmt, invalidateCache, cacheKey } from '../lib/cms.js';

const ALLOWED_TYPES = ['text', 'faq', 'config', 'prompt'];

/**
 * GET — seznam sekcí, jedna sekce (?key=) nebo audit historie (?history=1).
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);

    // Audit historie CMS změn (texty, galerie, hero)
    if (url.searchParams.get('history')) {
      const { results } = await env.DB.prepare(
        `SELECT id, entity, entity_id, action, actor, details, created_at
         FROM audit_log
         WHERE entity IN ('content_blocks', 'gallery_items', 'hero_config')
         ORDER BY created_at DESC
         LIMIT 100`
      ).all();
      return json({ ok: true, data: { history: results || [] } });
    }

    const key = url.searchParams.get('key');
    if (key) {
      const row = await env.DB.prepare(
        'SELECT id, section_key, title, content_markdown, content_type, updated_at FROM content_blocks WHERE section_key = ?'
      ).bind(key).first();
      if (!row) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);
      return json({ ok: true, data: row });
    }

    const { results } = await env.DB.prepare(
      'SELECT id, section_key, title, content_markdown, content_type, updated_at FROM content_blocks ORDER BY section_key'
    ).all();
    return json({ ok: true, data: { sections: results || [] } });
  } catch (err) {
    console.error('[admin/content] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání obsahu.' }, 500);
  }
}

/**
 * POST — vytvoří novou textovou sekci (content_blocks) + audit + cache invalidace.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const section_key = stripTags(body.section_key, 120);
    const title = stripTags(body.title, 200);
    const content_type = ALLOWED_TYPES.includes(body.content_type) ? body.content_type : 'text';
    const content = sanitizeHTML(body.content_markdown);

    if (!section_key || !title || !content) {
      return json({ ok: false, error: 'Klíč, název i obsah jsou povinné.' }, 400);
    }
    if (!/^[a-z0-9-]+$/.test(section_key)) {
      return json({ ok: false, error: 'Klíč smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }

    const existing = await env.DB.prepare('SELECT id FROM content_blocks WHERE section_key = ?').bind(section_key).first();
    if (existing) return json({ ok: false, error: 'Sekce s tímto klíčem už existuje.' }, 409);

    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO content_blocks (id, section_key, title, content_markdown, content_type, last_updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, section_key, title, content, content_type, data.operator.id),
      auditStmt(env.DB, 'content_blocks', id, 'create', data.operator, `Vytvořena sekce „${section_key}"`),
    ]);

    await invalidateCache(env, cacheKey.section(section_key));
    return json({ ok: true, data: { id, section_key } }, 201);
  } catch (err) {
    console.error('[admin/content] POST error:', err);
    return json({ ok: false, error: 'Chyba při vytváření sekce.' }, 500);
  }
}

/**
 * PUT — upraví existující sekci dle section_key + audit + cache invalidace.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const section_key = stripTags(body.section_key, 120);
    if (!section_key) return json({ ok: false, error: 'Chybí klíč sekce.' }, 400);

    const existing = await env.DB.prepare('SELECT * FROM content_blocks WHERE section_key = ?').bind(section_key).first();
    if (!existing) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);

    const title = body.title != null ? stripTags(body.title, 200) : existing.title;
    const content = body.content_markdown != null ? sanitizeHTML(body.content_markdown) : existing.content_markdown;
    const content_type = ALLOWED_TYPES.includes(body.content_type) ? body.content_type : existing.content_type;

    if (!title || !content) {
      return json({ ok: false, error: 'Název i obsah jsou povinné.' }, 400);
    }

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE content_blocks
         SET title = ?, content_markdown = ?, content_type = ?, last_updated_by = ?, updated_at = datetime('now')
         WHERE section_key = ?`
      ).bind(title, content, content_type, data.operator.id, section_key),
      auditStmt(env.DB, 'content_blocks', existing.id, 'update', data.operator, `Upravena sekce „${section_key}"`),
    ]);

    await invalidateCache(env, cacheKey.section(section_key));
    return json({ ok: true, data: { section_key } });
  } catch (err) {
    console.error('[admin/content] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání sekce.' }, 500);
  }
}

/**
 * DELETE — smaže sekci dle ?key= + audit + cache invalidace.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 * @returns {Promise<Response>}
 */
export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const section_key = url.searchParams.get('key');
    if (!section_key) return json({ ok: false, error: 'Chybí klíč sekce.' }, 400);

    const existing = await env.DB.prepare('SELECT id FROM content_blocks WHERE section_key = ?').bind(section_key).first();
    if (!existing) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);

    await env.DB.batch([
      env.DB.prepare('DELETE FROM content_blocks WHERE section_key = ?').bind(section_key),
      auditStmt(env.DB, 'content_blocks', existing.id, 'delete', data.operator, `Smazána sekce „${section_key}"`),
    ]);

    await invalidateCache(env, cacheKey.section(section_key));
    return json({ ok: true, data: { section_key } });
  } catch (err) {
    console.error('[admin/content] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání sekce.' }, 500);
  }
}
