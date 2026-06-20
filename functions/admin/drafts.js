/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Pojmenované koncepty / verze (content_drafts) — F12-D
 * ═══════════════════════════════════════════════════════════════
 * Snapshoty PRACOVNÍHO konceptu entit content_blocks / hero_config / services.
 * Pracovní (inline) koncept ani publikační/náhledová pipeline se NEmění —
 * tohle je jen úložiště pojmenovaných verzí, ze kterých lze koncept „načíst".
 *
 * GET    /admin/drafts?entity=&entity_id=        — seznam verzí (bez payloadu)
 * POST   /admin/drafts {entity,entity_id,name,payload}  — uložit/aktualizovat verzi
 * POST   /admin/drafts {action:'load', id}       — načíst verzi do pracovního konceptu
 * PUT    /admin/drafts {id, name}                — přejmenovat verzi
 * DELETE /admin/drafts?id=ID                      — smazat verzi
 *
 * Verze jsou jen pod CF Access (functions/admin/_middleware.js) a NIKDY se
 * neservírují přes veřejné /api/*. Auth: data.operator.
 * ═══════════════════════════════════════════════════════════════
 */

import { json, auditStmt, applyWorkingDraftStmt, draftKeyColumn, DRAFT_ENTITIES } from '../lib/cms.js';
import { stripTags } from '../lib/sanitize.js';
import { prepareContent } from './content.js';
import { prepareHero } from './hero.js';
import { prepareService } from './services.js';

const MAX_VERSIONS = 20;

/** Načte živý/draft řádek entity dle jejího klíče. @returns {Promise<Object|null>} */
async function loadEntityRow(env, entity, entityId) {
  const col = draftKeyColumn(entity);
  if (!col) return null;
  // entity je z whitelistu DRAFT_ENTITIES → bezpečné jako název tabulky.
  return env.DB.prepare(`SELECT * FROM ${entity} WHERE ${col} = ?`).bind(entityId).first();
}

/**
 * Sanitizuje a normalizuje vstup editoru na payload verze dle entity
 * (reuse prepare* z handlerů). `input` = obsah editoru (body.payload).
 * @returns {{payload:Object}|{error:string}}
 */
function sanitizePayload(entity, input, existing) {
  if (entity === 'content_blocks') {
    const contentType = existing.content_type;
    const rawContent = input.content_markdown != null
      ? String(input.content_markdown)
      : (existing.draft_content_markdown ?? existing.content_markdown ?? '');
    const prep = prepareContent(contentType, rawContent);
    if (prep.error) return { error: prep.error };
    const title = input.title != null ? stripTags(input.title, 200) : (existing.draft_title ?? existing.title ?? '');
    return { payload: { title, content_markdown: prep.content } };
  }
  if (entity === 'hero_config') {
    const prep = prepareHero(input, existing);
    if (prep.error) return { error: prep.error };
    return { payload: prep.hero };
  }
  // services
  const prep = prepareService(input, existing);
  if (prep.error) return { error: prep.error };
  return { payload: prep.svc };
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const entity = url.searchParams.get('entity');
    const entityId = url.searchParams.get('entity_id');
    if (!DRAFT_ENTITIES.includes(entity)) return json({ ok: false, error: 'Neplatná entita.' }, 400);
    if (!entityId) return json({ ok: false, error: 'Chybí entity_id.' }, 400);

    const { results } = await env.DB.prepare(
      `SELECT id, name, created_by, created_at, updated_at FROM content_drafts
       WHERE entity = ? AND entity_id = ? ORDER BY updated_at DESC`
    ).bind(entity, entityId).all();
    return json({ ok: true, data: { versions: results || [] } });
  } catch (err) {
    console.error('[admin/drafts] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání verzí.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const body = await request.json();
    if (body.action === 'load') return handleLoad(env, data, body.id);

    const entity = body.entity;
    const entityId = stripTags(body.entity_id, 200);
    const name = stripTags(body.name, 120);
    if (!DRAFT_ENTITIES.includes(entity)) return json({ ok: false, error: 'Neplatná entita.' }, 400);
    if (!entityId) return json({ ok: false, error: 'Chybí entity_id.' }, 400);
    if (!name) return json({ ok: false, error: 'Zadejte název verze.' }, 400);

    const existing = await loadEntityRow(env, entity, entityId);
    if (!existing) return json({ ok: false, error: 'Záznam nenalezen.' }, 404);

    const prep = sanitizePayload(entity, body.payload || {}, existing);
    if (prep.error) return json({ ok: false, error: prep.error }, 400);

    // Limit počtu verzí (nová jména) — přepis existující verze limitem neprochází.
    const already = await env.DB.prepare(
      'SELECT id FROM content_drafts WHERE entity = ? AND entity_id = ? AND name = ?'
    ).bind(entity, entityId, name).first();
    if (!already) {
      const cnt = await env.DB.prepare(
        'SELECT COUNT(*) AS c FROM content_drafts WHERE entity = ? AND entity_id = ?'
      ).bind(entity, entityId).first();
      if ((cnt?.c || 0) >= MAX_VERSIONS) {
        return json({ ok: false, error: `Limit ${MAX_VERSIONS} verzí na položku byl dosažen. Smažte nepotřebnou verzi.` }, 400);
      }
    }

    const id = already?.id || crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO content_drafts (id, entity, entity_id, name, payload_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(entity, entity_id, name)
         DO UPDATE SET payload_json = excluded.payload_json, updated_at = datetime('now')`
      ).bind(id, entity, entityId, name, JSON.stringify(prep.payload), data.operator.id),
      auditStmt(env.DB, entity, entityId, 'update', data.operator, `Uložena verze konceptu „${name}"`),
    ]);
    // Při souběžném zápisu může ON CONFLICT zachovat cizí id — vrať skutečně uložené.
    const stored = await env.DB.prepare(
      'SELECT id FROM content_drafts WHERE entity = ? AND entity_id = ? AND name = ?'
    ).bind(entity, entityId, name).first();
    return json({ ok: true, data: { id: stored?.id || id, name } }, already ? 200 : 201);
  } catch (err) {
    console.error('[admin/drafts] POST error:', err);
    return json({ ok: false, error: 'Chyba při ukládání verze.' }, 500);
  }
}

/** Načte snapshot do pracovního konceptu entity (has_draft=1). */
async function handleLoad(env, data, idRaw) {
  const id = stripTags(idRaw, 80);
  const snap = await env.DB.prepare('SELECT * FROM content_drafts WHERE id = ?').bind(id).first();
  if (!snap) return json({ ok: false, error: 'Verze nenalezena.' }, 404);

  const existing = await loadEntityRow(env, snap.entity, snap.entity_id);
  if (!existing) return json({ ok: false, error: 'Cílový záznam už neexistuje.' }, 404);

  let payload;
  try { payload = JSON.parse(snap.payload_json); } catch { return json({ ok: false, error: 'Poškozená verze.' }, 422); }

  await env.DB.batch([
    applyWorkingDraftStmt(env, snap.entity, snap.entity_id, payload, data.operator.id),
    auditStmt(env.DB, snap.entity, snap.entity_id, 'update', data.operator, `Načtena verze konceptu „${snap.name}"`),
  ]);
  return json({ ok: true, data: { entity: snap.entity, entity_id: snap.entity_id, loaded: true } });
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const body = await request.json();
    const id = stripTags(body.id, 80);
    const name = stripTags(body.name, 120);
    if (!id || !name) return json({ ok: false, error: 'Chybí id nebo název.' }, 400);

    const snap = await env.DB.prepare('SELECT entity, entity_id FROM content_drafts WHERE id = ?').bind(id).first();
    if (!snap) return json({ ok: false, error: 'Verze nenalezena.' }, 404);

    const clash = await env.DB.prepare(
      'SELECT id FROM content_drafts WHERE entity = ? AND entity_id = ? AND name = ? AND id != ?'
    ).bind(snap.entity, snap.entity_id, name, id).first();
    if (clash) return json({ ok: false, error: 'Verze s tímto názvem už existuje.' }, 409);

    await env.DB.batch([
      env.DB.prepare(`UPDATE content_drafts SET name = ?, updated_at = datetime('now') WHERE id = ?`).bind(name, id),
      auditStmt(env.DB, snap.entity, snap.entity_id, 'update', data.operator, `Přejmenována verze konceptu na „${name}"`),
    ]);
    return json({ ok: true, data: { id, name } });
  } catch (err) {
    console.error('[admin/drafts] PUT error:', err);
    return json({ ok: false, error: 'Chyba při přejmenování verze.' }, 500);
  }
}

export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const id = stripTags(new URL(request.url).searchParams.get('id'), 80);
    if (!id) return json({ ok: false, error: 'Chybí id.' }, 400);
    const snap = await env.DB.prepare('SELECT entity, entity_id, name FROM content_drafts WHERE id = ?').bind(id).first();
    if (!snap) return json({ ok: false, error: 'Verze nenalezena.' }, 404);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM content_drafts WHERE id = ?').bind(id),
      auditStmt(env.DB, snap.entity, snap.entity_id, 'update', data.operator, `Smazána verze konceptu „${snap.name}"`),
    ]);
    return json({ ok: true, data: { id } });
  } catch (err) {
    console.error('[admin/drafts] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání verze.' }, 500);
  }
}
