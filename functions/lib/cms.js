/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS sdílené pomocné funkce (F11)
 * ═══════════════════════════════════════════════════════════════
 * Audit změn obsahu (do existující tabulky audit_log) a invalidace
 * KV cache (binding CACHE) pro veřejné CMS endpointy.
 * ═══════════════════════════════════════════════════════════════
 */

export { json } from './http.js';


/**
 * Zapíše změnu obsahu do audit_log.
 * @param {D1Database} db
 * @param {string} entity     — 'content_blocks' | 'gallery_items' | 'hero_config'
 * @param {string} entityId
 * @param {'create'|'update'|'delete'} action
 * @param {Object} operator   — data.operator z middleware
 * @param {string} details    — lidsky čitelný popis změny
 */
export function auditStmt(db, entity, entityId, action, operator, details) {
  const actor = operator?.id ? `operator:${operator.id}` : 'operator:unknown';
  return db
    .prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), entity, entityId, action, actor, details || '');
}

/**
 * Bezpečně smaže klíč z KV cache (chyba cache nesmí shodit zápis).
 * @param {Object} env
 * @param {string} key
 */
export async function invalidateCache(env, key) {
  try {
    if (env.CACHE) await env.CACHE.delete(key);
  } catch (err) {
    console.warn('[cms] cache invalidation failed:', err?.message);
  }
}

/** Cache klíče pro veřejné endpointy. */
export const cacheKey = {
  section: (key) => `cms:section:${key}`,
  gallery: (key) => `cms:gallery:${key}`,
  hero: (key) => `cms:hero:${key}`,
};

/** Entity, které mají draft/publish vrstvu (a tedy i pojmenované koncepty). */
export const DRAFT_ENTITIES = ['content_blocks', 'hero_config', 'services'];

/** Klíčový sloupec entity pro WHERE (entity_id). @param {string} entity @returns {string|null} */
export function draftKeyColumn(entity) {
  if (entity === 'content_blocks') return 'section_key';
  if (entity === 'hero_config') return 'page_key';
  if (entity === 'services') return 'slug';
  return null;
}

/**
 * Vrátí prepared statement, který zapíše payload do PRACOVNÍHO konceptu entity
 * (draft sloupce, has_draft=1). Payload musí být už sanitizovaný (viz drafts.js).
 * Sjednocuje zápis konceptu napříč entitami (reuse pro „načíst verzi").
 * @param {Object} env @param {string} entity @param {string} entityId
 * @param {Object} payload @param {string} operatorId
 * @returns {D1PreparedStatement}
 */
export function applyWorkingDraftStmt(env, entity, entityId, payload, operatorId) {
  if (entity === 'content_blocks') {
    return env.DB.prepare(
      `UPDATE content_blocks SET draft_title = ?, draft_content_markdown = ?, has_draft = 1,
              draft_updated_at = datetime('now'), draft_updated_by = ? WHERE section_key = ?`
    ).bind(payload.title ?? null, payload.content_markdown ?? '', operatorId, entityId);
  }
  if (entity === 'hero_config') {
    return env.DB.prepare(
      `UPDATE hero_config SET draft_json = ?, has_draft = 1, updated_by = ?, updated_at = datetime('now') WHERE page_key = ?`
    ).bind(JSON.stringify(payload), operatorId, entityId);
  }
  // services
  return env.DB.prepare(
    `UPDATE services SET draft_json = ?, has_draft = 1, updated_at = datetime('now') WHERE slug = ?`
  ).bind(JSON.stringify(payload), entityId);
}

/**
 * Smaže všechny cache klíče služeb (`services:all`, `services:category:*`).
 * Volá se po publish/zveřejnění změny služby.
 * @param {Object} env
 */
export async function invalidateServicesCache(env) {
  try {
    if (!env.CACHE) return;
    let cursor;
    do {
      const list = await env.CACHE.list({ prefix: 'services:', cursor });
      for (const k of list?.keys || []) {
        await env.CACHE.delete(k.name);
      }
      cursor = list?.list_complete ? undefined : list?.cursor;
    } while (cursor);
  } catch (err) {
    console.warn('[cms] services cache invalidation failed:', err?.message);
  }
}
