/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS sdílené pomocné funkce (F11)
 * ═══════════════════════════════════════════════════════════════
 * Audit změn obsahu (do existující tabulky audit_log) a invalidace
 * KV cache (binding CACHE) pro veřejné CMS endpointy.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * JSON Response helper (sjednocený formát {ok, data, error}).
 * @param {*} data
 * @param {number} [status=200]
 * @param {Object} [headers={}] — volitelné extra hlavičky (nepřepíšou Content-Type)
 * @returns {Response}
 */
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

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
