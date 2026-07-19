/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Galerie obrázků (draft/publish workflow)
 * ═══════════════════════════════════════════════════════════════
 * GET    /admin/gallery?key=KEY                — efektivní položky galerie (draft, jinak live)
 * GET    /admin/gallery?key=KEY&preview=1      — jen {items} pro preview klient
 * GET    /admin/gallery                         — seznam galerií + has_draft
 * POST   /admin/gallery (multipart)            — upload obrázku do KONCEPTU
 * POST   /admin/gallery {action:publish|discard,gallery_key}
 * PUT    /admin/gallery                         — metadata/reorder do KONCEPTU
 * DELETE /admin/gallery?id=ID&gallery_key=KEY  — smazání položky v KONCEPTU
 * ═══════════════════════════════════════════════════════════════
 */

import { json, auditStmt, invalidateCache, cacheKey } from '../lib/cms.js';
import { stripTags } from '../lib/sanitize.js';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const UPLOAD_LIMIT = 10; // uploadů
const UPLOAD_WINDOW = 60; // za sekund

/** @param {string} v */
function isValidGalleryKey(v) {
  return !!v && /^[a-z0-9-]+$/.test(v);
}

/** @param {string} imageUrl */
function isManagedMedia(imageUrl) {
  return !!imageUrl && imageUrl.startsWith('/api/media/');
}

/** @param {string} imageUrl */
function mediaKeyFromUrl(imageUrl) {
  return imageUrl.replace('/api/media/', '');
}

/** @param {Array<Object>} items */
function normalizeSort(items) {
  return items
    .map((it, i) => ({ ...it, sort_order: i + 1 }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

/** @param {Object} row */
function toItem(row) {
  return {
    id: String(row.id),
    gallery_key: String(row.gallery_key),
    title: row.title || '',
    caption: row.caption || '',
    image_url: row.image_url || '',
    image_filename: row.image_filename || '',
    sort_order: Number(row.sort_order) || 0,
    active: row.active ? 1 : 0,
    updated_by: row.updated_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

/**
 * Sanitizuje položku draftu do konzistentního shape.
 * @param {Object} raw
 * @param {string} galleryKey
 * @param {number} index
 * @returns {Object}
 */
function sanitizeDraftItem(raw, galleryKey, index) {
  const id = stripTags(raw?.id, 80) || crypto.randomUUID();
  return {
    id,
    gallery_key: galleryKey,
    title: stripTags(raw?.title, 200) || '',
    caption: stripTags(raw?.caption, 500) || '',
    image_url: stripTags(raw?.image_url, 1000) || '',
    image_filename: stripTags(raw?.image_filename, 255) || '',
    sort_order: Number(raw?.sort_order) || (index + 1),
    active: raw?.active === 0 || raw?.active === false ? 0 : 1,
    updated_by: stripTags(raw?.updated_by, 80) || null,
    created_at: raw?.created_at || null,
    updated_at: raw?.updated_at || null,
  };
}

/** @param {string} raw @param {string} galleryKey */
function parseDraftItems(raw, galleryKey) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return normalizeSort(
    parsed
      .map((it, i) => sanitizeDraftItem(it, galleryKey, i))
      .filter((it) => !!it.image_url)
  );
}

/** Jednoduchý KV rate-limit (10 uploadů / min / operátor). */
async function checkUploadLimit(env, operatorId) {
  if (!env.CACHE) return true;
  const k = `cms:uploadrate:${operatorId}`;
  try {
    const current = parseInt((await env.CACHE.get(k)) || '0', 10);
    if (current >= UPLOAD_LIMIT) return false;
    await env.CACHE.put(k, String(current + 1), { expirationTtl: UPLOAD_WINDOW });
    return true;
  } catch {
    return true;
  }
}

/** @param {Object} env @param {string} galleryKey */
async function loadLiveItems(env, galleryKey) {
  const { results } = await env.DB.prepare(
    `SELECT id, gallery_key, title, caption, image_url, image_filename, sort_order, active, updated_by, created_at, updated_at
     FROM gallery_items WHERE gallery_key = ? ORDER BY sort_order, created_at`
  ).bind(galleryKey).all();
  return (results || []).map(toItem);
}

/** @param {Object} env @param {string} galleryKey */
async function loadDraftRow(env, galleryKey) {
  return env.DB.prepare(
    'SELECT gallery_key, draft_json, updated_by, updated_at FROM gallery_drafts WHERE gallery_key = ?'
  ).bind(galleryKey).first();
}

/** @param {Object} env @param {string} galleryKey */
async function loadEffectiveGallery(env, galleryKey) {
  const [liveItems, draftRow] = await Promise.all([
    loadLiveItems(env, galleryKey),
    loadDraftRow(env, galleryKey),
  ]);
  const draftItems = draftRow ? parseDraftItems(draftRow.draft_json, galleryKey) : null;
  return {
    hasDraft: !!draftRow,
    draftItems,
    liveItems,
    effectiveItems: draftItems || liveItems,
  };
}

/** @param {Object} env @param {string} galleryKey @param {Array<Object>} items @param {string} operatorId */
async function saveDraft(env, galleryKey, items, operatorId) {
  const payload = JSON.stringify(normalizeSort(items).map((it, i) => sanitizeDraftItem(it, galleryKey, i)));
  await env.DB.prepare(
    `INSERT INTO gallery_drafts (gallery_key, draft_json, updated_by, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(gallery_key)
     DO UPDATE SET draft_json = excluded.draft_json, updated_by = excluded.updated_by, updated_at = datetime('now')`
  ).bind(galleryKey, payload, operatorId).run();
}

/**
 * Smaže R2 objekty, které už po publish/discard nikde v live datech nezůstaly.
 * @param {Object} env
 * @param {Array<string>} urls
 */
async function cleanupOrphanMedia(env, urls) {
  if (!env.MEDIA || !Array.isArray(urls) || !urls.length) return;
  for (const url of urls) {
    if (!isManagedMedia(url)) continue;
    const inUse = await env.DB.prepare('SELECT COUNT(*) AS c FROM gallery_items WHERE image_url = ?').bind(url).first();
    if ((Number(inUse?.c) || 0) > 0) continue;
    try {
      await env.MEDIA.delete(mediaKeyFromUrl(url));
    } catch (err) {
      console.warn('[admin/gallery] orphan media cleanup failed:', err?.message);
    }
  }
}

/**
 * Výčet galerií z live + draft zdrojů.
 * @param {Object} env
 * @returns {Promise<Array<Object>>}
 */
async function listGalleries(env) {
  const [live, drafts] = await Promise.all([
    env.DB.prepare(
      `SELECT gallery_key, COUNT(*) AS count
       FROM gallery_items GROUP BY gallery_key`
    ).all(),
    env.DB.prepare('SELECT gallery_key, draft_json FROM gallery_drafts').all(),
  ]);
  const map = new Map();
  for (const row of (live.results || [])) {
    map.set(row.gallery_key, {
      gallery_key: row.gallery_key,
      count: Number(row.count) || 0,
      has_draft: 0,
    });
  }
  for (const row of (drafts.results || [])) {
    const draftItems = parseDraftItems(row.draft_json, row.gallery_key);
    map.set(row.gallery_key, {
      gallery_key: row.gallery_key,
      count: draftItems.length,
      has_draft: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.gallery_key.localeCompare(b.gallery_key));
}

/**
 * GET — seznam galerií nebo detail jedné galerie.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 */
export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const key = stripTags(url.searchParams.get('key'), 120);

    if (key) {
      const source = url.searchParams.get('source'); // live|effective
      const preview = !!url.searchParams.get('preview');
      const snap = await loadEffectiveGallery(env, key);
      const items = source === 'live' ? snap.liveItems : snap.effectiveItems;
      if (preview) return json({ ok: true, data: { items } });
      return json({
        ok: true,
        data: {
          gallery_key: key,
          has_draft: snap.hasDraft ? 1 : 0,
          items,
        },
      });
    }

    const galleries = await listGalleries(env);
    return json({ ok: true, data: { galleries } });
  } catch (err) {
    console.error('[admin/gallery] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání galerie.' }, 500);
  }
}

/**
 * POST — upload do draftu nebo publish/discard draftu.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 */
export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      return handleDraftAction(env, data, body);
    }
    return handleUpload(env, data, request);
  } catch (err) {
    console.error('[admin/gallery] POST error:', err);
    return json({ ok: false, error: 'Chyba při zpracování galerie.' }, 500);
  }
}

/** @param {Object} env @param {Object} data @param {Request} request */
async function handleUpload(env, data, request) {
  if (!env.MEDIA) return json({ ok: false, error: 'Úložiště médií (R2) není dostupné.' }, 503);
  if (!(await checkUploadLimit(env, data.operator.id))) {
    return json({ ok: false, error: 'Příliš mnoho uploadů — zkuste to za chvíli.' }, 429);
  }

  const form = await request.formData();
  const file = form.get('file');
  const galleryKey = stripTags(form.get('gallery_key'), 120);
  if (!file || typeof file === 'string') return json({ ok: false, error: 'Chybí soubor.' }, 400);
  if (!isValidGalleryKey(galleryKey)) {
    return json({ ok: false, error: 'Klíč galerie smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
  }
  if (file.size > MAX_BYTES) return json({ ok: false, error: 'Soubor je větší než 5 MB.' }, 413);

  const ext = MIME_EXT[file.type];
  if (!ext) return json({ ok: false, error: 'Povolené formáty: JPEG, PNG, WebP, GIF.' }, 415);

  const r2Key = `cms/${galleryKey}/${crypto.randomUUID()}.${ext}`;
  await env.MEDIA.put(r2Key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

  try {
    const snap = await loadEffectiveGallery(env, galleryKey);
    const nowIso = new Date().toISOString();
    const item = {
      id: crypto.randomUUID(),
      gallery_key: galleryKey,
      title: '',
      caption: '',
      image_url: `/api/media/${r2Key}`,
      image_filename: stripTags(file.name, 255) || `${ext}`,
      sort_order: snap.effectiveItems.length + 1,
      active: 1,
      updated_by: data.operator.id,
      created_at: nowIso,
      updated_at: nowIso,
    };
    const items = normalizeSort([...snap.effectiveItems, item]);
    await saveDraft(env, galleryKey, items, data.operator.id);
    await auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Uložen koncept galerie „${galleryKey}" (nahrán obrázek)`).run();
    return json({ ok: true, data: { id: item.id, image_url: item.image_url, has_draft: 1 } }, 201);
  } catch (err) {
    try { await env.MEDIA.delete(r2Key); } catch {}
    throw err;
  }
}

/**
 * PUT — metadata nebo reorder do draftu.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 */
export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const body = await request.json();

    if (body.action === 'reorder' && Array.isArray(body.items)) {
      const galleryKey = stripTags(body.gallery_key, 120);
      if (!isValidGalleryKey(galleryKey)) return json({ ok: false, error: 'Chybí klíč galerie.' }, 400);

      const snap = await loadEffectiveGallery(env, galleryKey);
      const rank = new Map(
        body.items.map((it, idx) => [String(it.id), Number(it.sort_order) || idx + 1])
      );
      const sorted = [...snap.effectiveItems]
        .sort((a, b) => (rank.get(a.id) ?? 999999) - (rank.get(b.id) ?? 999999));
      const items = normalizeSort(sorted);
      await saveDraft(env, galleryKey, items, data.operator.id);
      await auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Uložen koncept galerie „${galleryKey}" (změna pořadí)`).run();
      return json({ ok: true, data: { reordered: items.length, has_draft: 1 } });
    }

    const galleryKey = stripTags(body.gallery_key, 120);
    const id = stripTags(body.id, 80);
    if (!isValidGalleryKey(galleryKey)) return json({ ok: false, error: 'Chybí klíč galerie.' }, 400);
    if (!id) return json({ ok: false, error: 'Chybí ID obrázku.' }, 400);

    const snap = await loadEffectiveGallery(env, galleryKey);
    const idx = snap.effectiveItems.findIndex((it) => it.id === id);
    if (idx < 0) return json({ ok: false, error: 'Obrázek nenalezen.' }, 404);

    const current = snap.effectiveItems[idx];
    const next = {
      ...current,
      title: body.title != null ? stripTags(body.title, 200) : current.title,
      caption: body.caption != null ? stripTags(body.caption, 500) : current.caption,
      active: body.active != null ? (body.active ? 1 : 0) : current.active,
      updated_by: data.operator.id,
      updated_at: new Date().toISOString(),
    };
    const items = [...snap.effectiveItems];
    items[idx] = next;
    await saveDraft(env, galleryKey, normalizeSort(items), data.operator.id);
    await auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Uložen koncept galerie „${galleryKey}" (úprava obrázku)`).run();
    return json({ ok: true, data: { id, has_draft: 1 } });
  } catch (err) {
    console.error('[admin/gallery] PUT error:', err);
    return json({ ok: false, error: 'Chyba při úpravě obrázku.' }, 500);
  }
}

/**
 * DELETE — smaže položku z draftu galerie.
 * @param {{ env: Object, data: Object, request: Request }} ctx
 */
export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  try {
    const url = new URL(request.url);
    const id = stripTags(url.searchParams.get('id'), 80);
    const galleryKey = stripTags(url.searchParams.get('gallery_key'), 120);
    if (!id) return json({ ok: false, error: 'Chybí ID obrázku.' }, 400);
    if (!isValidGalleryKey(galleryKey)) return json({ ok: false, error: 'Chybí klíč galerie.' }, 400);

    const snap = await loadEffectiveGallery(env, galleryKey);
    const found = snap.effectiveItems.find((it) => it.id === id);
    if (!found) return json({ ok: false, error: 'Obrázek nenalezen.' }, 404);

    const items = normalizeSort(snap.effectiveItems.filter((it) => it.id !== id));
    await saveDraft(env, galleryKey, items, data.operator.id);
    await auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Uložen koncept galerie „${galleryKey}" (smazání obrázku)`).run();
    const existsInLive = snap.liveItems.some((it) => it.image_url === found.image_url);
    if (!existsInLive) await cleanupOrphanMedia(env, [found.image_url]);
    return json({ ok: true, data: { id, has_draft: 1 } });
  } catch (err) {
    console.error('[admin/gallery] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání obrázku.' }, 500);
  }
}

/** @param {Object} env @param {Object} data @param {Object} body */
async function handleDraftAction(env, data, body) {
  const action = body?.action;
  const galleryKey = stripTags(body?.gallery_key, 120);
  if (!isValidGalleryKey(galleryKey)) return json({ ok: false, error: 'Chybí klíč galerie.' }, 400);
  if (action !== 'publish' && action !== 'discard') return json({ ok: false, error: 'Neznámá akce.' }, 400);

  const draftRow = await loadDraftRow(env, galleryKey);
  if (!draftRow) return json({ ok: false, error: 'Žádný koncept galerie.' }, 409);

  const draftItems = parseDraftItems(draftRow.draft_json, galleryKey);
  const liveItems = await loadLiveItems(env, galleryKey);

  if (action === 'discard') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM gallery_drafts WHERE gallery_key = ?').bind(galleryKey),
      auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Zahozen koncept galerie „${galleryKey}"`),
    ]);
    const liveUrls = new Set(liveItems.map((it) => it.image_url));
    const candidateUrls = draftItems.map((it) => it.image_url).filter((url) => !liveUrls.has(url));
    await cleanupOrphanMedia(env, candidateUrls);
    return json({ ok: true, data: { gallery_key: galleryKey, discarded: true, has_draft: 0 } });
  }

  const statements = [
    env.DB.prepare('DELETE FROM gallery_items WHERE gallery_key = ?').bind(galleryKey),
  ];
  for (const item of normalizeSort(draftItems)) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO gallery_items (id, gallery_key, title, caption, image_url, image_filename, sort_order, active, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), datetime('now'))`
      ).bind(
        item.id, galleryKey, item.title || '', item.caption || '', item.image_url, item.image_filename || '',
        Number(item.sort_order) || 0, item.active ? 1 : 0, data.operator.id, item.created_at || null
      )
    );
  }
  statements.push(
    env.DB.prepare('DELETE FROM gallery_drafts WHERE gallery_key = ?').bind(galleryKey),
    auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Zveřejněna galerie „${galleryKey}"`)
  );
  await env.DB.batch(statements);

  const draftUrls = new Set(draftItems.map((it) => it.image_url));
  const removedUrls = liveItems.map((it) => it.image_url).filter((url) => !draftUrls.has(url));
  await cleanupOrphanMedia(env, removedUrls);
  await invalidateCache(env, cacheKey.gallery(galleryKey));
  return json({
    ok: true,
    data: { gallery_key: galleryKey, published: true, has_draft: 0, count: draftItems.length },
  });
}
