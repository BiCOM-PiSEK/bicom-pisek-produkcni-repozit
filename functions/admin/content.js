/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Textové sekce / config bloky (content_blocks)
 * ═══════════════════════════════════════════════════════════════
 * Workflow koncept → publikovat (F12):
 *   PUT    /admin/content                  — uložit ZMĚNU jako koncept (draft)
 *   POST   /admin/content {action:publish} — zveřejnit koncept (draft → živé)
 *   POST   /admin/content {action:discard} — zahodit koncept
 *   POST   /admin/content (bez action)     — vytvořit novou sekci (rovnou živou)
 *   GET    /admin/content                  — seznam (vč. has_draft)
 *   GET    /admin/content?key=KEY          — detail (živé + draft pole)
 *   GET    /admin/content?key=KEY&preview=1 — efektivní obsah (draft, jinak živé) pro náhled
 *   GET    /admin/content?history=1        — audit historie CMS změn
 *   DELETE /admin/content?key=KEY          — smazat sekci
 *
 * Veřejné /api/content vrací VŽDY jen živý obsah (koncepty nikdy nejsou public).
 * Auth zajišťuje functions/admin/_middleware.js → data.operator.
 * ═══════════════════════════════════════════════════════════════
 */

import { sanitizeHTML, stripTags } from '../lib/sanitize.js';
import { json, auditStmt, invalidateCache, cacheKey } from '../lib/cms.js';

const ALLOWED_TYPES = ['text', 'faq', 'config', 'prompt'];
const JSON_TYPES = ['config', 'faq'];

/**
 * Rekurzivně sanitizuje řetězcové listy v JSON struktuře (pro config/faq).
 * @param {*} value
 * @returns {*}
 */
function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeHTML(value, 5000);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out;
  }
  return value;
}

/**
 * Zvaliduje a sanitizuje obsah dle typu. Vrací { content, error }.
 * @param {string} type
 * @param {string} raw
 */
function prepareContent(type, raw) {
  if (JSON_TYPES.includes(type)) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { error: 'Obsah typu config/faq musí být platný JSON.' };
    }
    return { content: JSON.stringify(sanitizeDeep(parsed)) };
  }
  return { content: sanitizeHTML(raw) };
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);

    if (url.searchParams.get('history')) {
      const { results } = await env.DB.prepare(
        `SELECT id, entity, entity_id, action, actor, details, created_at
         FROM audit_log
         WHERE entity IN ('content_blocks', 'gallery_items', 'hero_config', 'services')
         ORDER BY created_at DESC
         LIMIT 100`
      ).all();
      return json({ ok: true, data: { history: results || [] } });
    }

    const key = url.searchParams.get('key');

    if (key) {
      const row = await env.DB.prepare(
        `SELECT id, section_key, title, content_markdown, content_type, updated_at,
                draft_title, draft_content_markdown, has_draft, draft_updated_at
         FROM content_blocks WHERE section_key = ?`
      ).bind(key).first();
      if (!row) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);

      // Náhled (preview client): vrať efektivní obsah (draft, jinak živé)
      if (url.searchParams.get('preview')) {
        return json({
          ok: true,
          data: {
            section_key: row.section_key,
            title: row.has_draft ? (row.draft_title ?? row.title) : row.title,
            content: row.has_draft ? (row.draft_content_markdown ?? row.content_markdown) : row.content_markdown,
            content_type: row.content_type,
          },
        });
      }
      return json({ ok: true, data: row });
    }

    const { results } = await env.DB.prepare(
      `SELECT id, section_key, title, content_type, has_draft, updated_at, draft_updated_at
       FROM content_blocks ORDER BY section_key`
    ).all();
    return json({ ok: true, data: { sections: results || [] } });
  } catch (err) {
    console.error('[admin/content] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání obsahu.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();

    // Akce nad konceptem
    if (body.action === 'publish' || body.action === 'discard') {
      return handleDraftAction(env, data, body.section_key, body.action);
    }

    // Vytvoření nové sekce (rovnou živá, bez konceptu)
    const section_key = stripTags(body.section_key, 120);
    const title = stripTags(body.title, 200);
    const content_type = ALLOWED_TYPES.includes(body.content_type) ? body.content_type : 'text';
    if (!section_key || !title || body.content_markdown == null) {
      return json({ ok: false, error: 'Klíč, název i obsah jsou povinné.' }, 400);
    }
    if (!/^[a-z0-9-]+$/.test(section_key)) {
      return json({ ok: false, error: 'Klíč smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }
    const prep = prepareContent(content_type, String(body.content_markdown));
    if (prep.error) return json({ ok: false, error: prep.error }, 400);

    const existing = await env.DB.prepare('SELECT id FROM content_blocks WHERE section_key = ?').bind(section_key).first();
    if (existing) return json({ ok: false, error: 'Sekce s tímto klíčem už existuje.' }, 409);

    const id = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO content_blocks (id, section_key, title, content_markdown, content_type, last_updated_by, updated_at, has_draft)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0)`
      ).bind(id, section_key, title, prep.content, content_type, data.operator.id),
      auditStmt(env.DB, 'content_blocks', id, 'create', data.operator, `Vytvořena sekce „${section_key}"`),
    ]);
    await invalidateCache(env, cacheKey.section(section_key));
    return json({ ok: true, data: { id, section_key } }, 201);
  } catch (err) {
    console.error('[admin/content] POST error:', err);
    return json({ ok: false, error: 'Chyba při zpracování požadavku.' }, 500);
  }
}

/** PUT — uloží změnu jako koncept (živý obsah se nemění). */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const section_key = stripTags(body.section_key, 120);
    if (!section_key) return json({ ok: false, error: 'Chybí klíč sekce.' }, 400);

    const existing = await env.DB.prepare('SELECT * FROM content_blocks WHERE section_key = ?').bind(section_key).first();
    if (!existing) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);

    // Typ se z konceptu NEmění (živý content_type zůstává) — slouží jen k validaci/sanitizaci obsahu.
    const content_type = existing.content_type;
    const title = body.title != null ? stripTags(body.title, 200) : existing.title;
    const rawContent = body.content_markdown != null ? String(body.content_markdown) : existing.content_markdown;
    const prep = prepareContent(content_type, rawContent);
    if (prep.error) return json({ ok: false, error: prep.error }, 400);

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE content_blocks
         SET draft_title = ?, draft_content_markdown = ?,
             has_draft = 1, draft_updated_at = datetime('now'), draft_updated_by = ?
         WHERE section_key = ?`
      ).bind(title, prep.content, data.operator.id, section_key),
      auditStmt(env.DB, 'content_blocks', existing.id, 'update', data.operator, `Uložen koncept sekce „${section_key}"`),
    ]);
    // Koncept se necachuje ani nepublikuje — veřejná cache zůstává.
    return json({ ok: true, data: { section_key, has_draft: 1 } });
  } catch (err) {
    console.error('[admin/content] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání konceptu.' }, 500);
  }
}

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

/**
 * Zveřejní (publish) nebo zahodí (discard) koncept sekce.
 * @param {Object} env
 * @param {Object} data
 * @param {string} keyRaw
 * @param {'publish'|'discard'} action
 * @returns {Promise<Response>}
 */
async function handleDraftAction(env, data, keyRaw, action) {
  const section_key = stripTags(keyRaw, 120);
  if (!section_key) return json({ ok: false, error: 'Chybí klíč sekce.' }, 400);

  const row = await env.DB.prepare('SELECT * FROM content_blocks WHERE section_key = ?').bind(section_key).first();
  if (!row) return json({ ok: false, error: 'Sekce nenalezena.' }, 404);
  if (!row.has_draft) return json({ ok: false, error: 'Žádný koncept k publikaci/zahození.' }, 409);

  if (action === 'publish') {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE content_blocks
         SET title = COALESCE(draft_title, title),
             content_markdown = COALESCE(draft_content_markdown, content_markdown),
             last_updated_by = ?, updated_at = datetime('now'),
             draft_title = NULL, draft_content_markdown = NULL, has_draft = 0,
             draft_updated_at = NULL, draft_updated_by = NULL
         WHERE section_key = ?`
      ).bind(data.operator.id, section_key),
      auditStmt(env.DB, 'content_blocks', row.id, 'update', data.operator, `Zveřejněna sekce „${section_key}"`),
    ]);
    await invalidateCache(env, cacheKey.section(section_key));
    return json({ ok: true, data: { section_key, published: true } });
  }

  // discard
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE content_blocks
       SET draft_title = NULL, draft_content_markdown = NULL, has_draft = 0,
           draft_updated_at = NULL, draft_updated_by = NULL
       WHERE section_key = ?`
    ).bind(section_key),
    auditStmt(env.DB, 'content_blocks', row.id, 'update', data.operator, `Zahozen koncept sekce „${section_key}"`),
  ]);
  return json({ ok: true, data: { section_key, discarded: true } });
}
