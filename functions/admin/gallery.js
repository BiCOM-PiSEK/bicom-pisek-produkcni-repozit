/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS: Galerie obrázků (gallery_items + R2 MEDIA)
 * ═══════════════════════════════════════════════════════════════
 * GET    /admin/gallery                       — seznam klíčů galerií + počty
 * GET    /admin/gallery?key=KEY               — položky jedné galerie
 * POST   /admin/gallery                       — upload obrázku (multipart: file, gallery_key)
 * PUT    /admin/gallery                        — metadata {id,title,caption} NEBO {action:'reorder',items}
 * DELETE /admin/gallery?id=ID                 — smazat obrázek (R2 + DB)
 *
 * Auth: functions/admin/_middleware.js → data.operator.
 * Obrázky se servírují přes /api/media/* (R2 binding MEDIA).
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
const UPLOAD_LIMIT = 10;       // uploadů
const UPLOAD_WINDOW = 60;      // za sekund

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
    return true; // cache výpadek nesmí blokovat operátora
  }
}

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (key) {
      const { results } = await env.DB.prepare(
        `SELECT id, gallery_key, title, caption, image_url, image_filename, sort_order, active
         FROM gallery_items WHERE gallery_key = ? ORDER BY sort_order, created_at`
      ).bind(key).all();
      return json({ ok: true, data: { items: results || [] } });
    }

    const { results } = await env.DB.prepare(
      `SELECT gallery_key, COUNT(*) AS count
       FROM gallery_items GROUP BY gallery_key ORDER BY gallery_key`
    ).all();
    return json({ ok: true, data: { galleries: results || [] } });
  } catch (err) {
    console.error('[admin/gallery] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání galerie.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    if (!env.MEDIA) {
      return json({ ok: false, error: 'Úložiště médií (R2) není dostupné.' }, 503);
    }
    if (!(await checkUploadLimit(env, data.operator.id))) {
      return json({ ok: false, error: 'Příliš mnoho uploadů — zkuste to za chvíli.' }, 429);
    }

    const form = await request.formData();
    const file = form.get('file');
    const galleryKeyRaw = form.get('gallery_key');
    const galleryKey = stripTags(galleryKeyRaw, 120);

    if (!file || typeof file === 'string') return json({ ok: false, error: 'Chybí soubor.' }, 400);
    if (!galleryKey) return json({ ok: false, error: 'Chybí klíč galerie.' }, 400);
    if (!/^[a-z0-9-]+$/.test(galleryKey)) {
      return json({ ok: false, error: 'Klíč galerie smí obsahovat jen malá písmena, číslice a pomlčky.' }, 400);
    }
    if (file.size > MAX_BYTES) return json({ ok: false, error: 'Soubor je větší než 5 MB.' }, 413);

    const ext = MIME_EXT[file.type];
    if (!ext) return json({ ok: false, error: 'Povolené formáty: JPEG, PNG, WebP, GIF.' }, 415);

    const r2Key = `cms/${galleryKey}/${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();
    await env.MEDIA.put(r2Key, buffer, { httpMetadata: { contentType: file.type } });

    const imageUrl = `/api/media/${r2Key}`;
    const id = crypto.randomUUID();
    const filename = stripTags(file.name, 255) || `${ext}`;

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO gallery_items (id, gallery_key, image_url, image_filename, sort_order, updated_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM gallery_items WHERE gallery_key = ?), ?, datetime('now'), datetime('now'))`
      ).bind(id, galleryKey, imageUrl, filename, galleryKey, data.operator.id),
      auditStmt(env.DB, 'gallery_items', id, 'create', data.operator, `Nahrán obrázek do galerie „${galleryKey}" (${filename})`),
    ]);

    await invalidateCache(env, cacheKey.gallery(galleryKey));
    return json({ ok: true, data: { id, image_url: imageUrl } }, 201);
  } catch (err) {
    console.error('[admin/gallery] POST error:', err);
    return json({ ok: false, error: 'Chyba při nahrávání obrázku.' }, 500);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();

    // Reorder (drag/up-down): { action: 'reorder', gallery_key, items: [{id, sort_order}] }
    if (body.action === 'reorder' && Array.isArray(body.items)) {
      const galleryKey = stripTags(body.gallery_key, 120);
      const stmts = body.items.map((it) =>
        env.DB.prepare('UPDATE gallery_items SET sort_order = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(Number(it.sort_order) || 0, String(it.id))
      );
      if (galleryKey) {
        stmts.push(auditStmt(env.DB, 'gallery_items', galleryKey, 'update', data.operator, `Změněno pořadí v galerii „${galleryKey}"`));
      }
      await env.DB.batch(stmts);
      if (galleryKey) await invalidateCache(env, cacheKey.gallery(galleryKey));
      return json({ ok: true, data: { reordered: body.items.length } });
    }

    // Metadata: { id, title, caption, active }
    const id = String(body.id || '');
    if (!id) return json({ ok: false, error: 'Chybí ID obrázku.' }, 400);

    const existing = await env.DB.prepare('SELECT * FROM gallery_items WHERE id = ?').bind(id).first();
    if (!existing) return json({ ok: false, error: 'Obrázek nenalezen.' }, 404);

    const title = body.title != null ? stripTags(body.title, 200) : existing.title;
    const caption = body.caption != null ? stripTags(body.caption, 500) : existing.caption;
    const active = body.active != null ? (body.active ? 1 : 0) : existing.active;

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE gallery_items SET title = ?, caption = ?, active = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(title, caption, active, data.operator.id, id),
      auditStmt(env.DB, 'gallery_items', id, 'update', data.operator, `Upraven obrázek v galerii „${existing.gallery_key}"`),
    ]);

    await invalidateCache(env, cacheKey.gallery(existing.gallery_key));
    return json({ ok: true, data: { id } });
  } catch (err) {
    console.error('[admin/gallery] PUT error:', err);
    return json({ ok: false, error: 'Chyba při úpravě obrázku.' }, 500);
  }
}

export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ ok: false, error: 'Chybí ID obrázku.' }, 400);

    const item = await env.DB.prepare('SELECT * FROM gallery_items WHERE id = ?').bind(id).first();
    if (!item) return json({ ok: false, error: 'Obrázek nenalezen.' }, 404);

    // Smazat z R2 jen vlastní nahrané soubory (cesta /api/media/...), ne statické /assets/...
    if (env.MEDIA && item.image_url?.startsWith('/api/media/')) {
      const r2Key = item.image_url.replace('/api/media/', '');
      try {
        await env.MEDIA.delete(r2Key);
      } catch (e) {
        console.warn('[admin/gallery] R2 delete failed:', e?.message);
      }
    }

    await env.DB.batch([
      env.DB.prepare('DELETE FROM gallery_items WHERE id = ?').bind(id),
      auditStmt(env.DB, 'gallery_items', id, 'delete', data.operator, `Smazán obrázek z galerie „${item.gallery_key}"`),
    ]);

    await invalidateCache(env, cacheKey.gallery(item.gallery_key));
    return json({ ok: true, data: { id } });
  } catch (err) {
    console.error('[admin/gallery] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání obrázku.' }, 500);
  }
}
