/**
 * BICOM PÍSEK — Blog Admin API
 * GET  /admin/blog — seznam s filtrací nebo detail
 * PUT  /admin/blog — akce nad článkem (update, publish, schedule, unpublish, archive)
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      const post = await env.DB.prepare(
        `SELECT id, slug, title, excerpt, content, image_url, jsonld, source, status, published_at, updated_at, created_at
         FROM blog_posts
         WHERE id = ?`
      ).bind(id).first();

      if (!post) {
        return json({ ok: false, error: 'Článek nenalezen.' }, 404);
      }

      return json({ ok: true, data: post });
    }

    // Seznam všech článků bez content (optimalizace payloadu)
    const { results } = await env.DB.prepare(
      `SELECT id, slug, title, excerpt, image_url, source, status, published_at, updated_at, created_at
       FROM blog_posts
       ORDER BY created_at DESC`
    ).all();

    return json({ ok: true, data: { posts: results || [] } });
  } catch (err) {
    console.error('[admin/blog] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání článků.' }, 500);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const body = await request.json();
    const { id, action, payload } = body;

    if (!id) {
      return json({ ok: false, error: 'Chybí ID článku.' }, 400);
    }

    // Ověřit, že článek existuje
    const post = await env.DB.prepare('SELECT id, status FROM blog_posts WHERE id = ?').bind(id).first();
    if (!post) {
      return json({ ok: false, error: 'Článek nenalezen.' }, 404);
    }

    let batch = [];
    let auditDetails = '';

    if (action === 'update') {
      const { title, excerpt, content, image_url } = payload || {};
      if (!title?.trim() || !content?.trim()) {
        return json({ ok: false, error: 'Titulek a obsah jsou povinné.' }, 400);
      }

      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET title = ?, excerpt = ?, content = ?, image_url = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).bind(title.trim(), excerpt?.trim() || '', content, image_url?.trim() || null, id)
      );
      auditDetails = 'Aktualizace obsahu článku';

    } else if (action === 'publish') {
      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET status = 'published', published_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`
        ).bind(id)
      );
      auditDetails = 'Publikace článku';

    } else if (action === 'schedule') {
      const { publish_at } = payload || {};
      if (!publish_at || isNaN(Date.parse(publish_at))) {
        return json({ ok: false, error: 'Neplatné datum publikování.' }, 400);
      }

      if (new Date(publish_at) <= new Date()) {
        return json({ ok: false, error: 'Datum publikace musí být v budoucnosti.' }, 400);
      }

      // SQLite vyžaduje formát YYYY-MM-DD HH:MM:SS v UTC
      const publishAtStr = new Date(publish_at).toISOString().replace('T', ' ').substring(0, 19);

      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET status = 'scheduled', published_at = ?, updated_at = datetime('now')
           WHERE id = ?`
        ).bind(publishAtStr, id)
      );
      auditDetails = `Naplánování publikace na: ${publishAtStr}`;

    } else if (action === 'unpublish') {
      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET status = 'draft', published_at = null, updated_at = datetime('now')
           WHERE id = ?`
        ).bind(id)
      );
      auditDetails = 'Vrácení do rozepsaných (unpublish)';

    } else if (action === 'archive') {
      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET status = 'archived', updated_at = datetime('now')
           WHERE id = ?`
        ).bind(id)
      );
      auditDetails = 'Archivace článku';

    } else {
      return json({ ok: false, error: `Neznámá akce: ${action}` }, 400);
    }

    // Přidat zápis do audit logu do transakce
    batch.push(
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'blog_posts', ?, 'update', ?, ?)`
      ).bind(crypto.randomUUID(), id, `operator:${data.operator.id}`, auditDetails)
    );

    // Spustit transakci
    await env.DB.batch(batch);

    // Invalidace KV cache při úpravě/publikaci/plánování/archivaci
    if (['update', 'publish', 'schedule', 'unpublish', 'archive'].includes(action)) {
      try {
        const list = await env.CACHE.list({ prefix: 'blog:published:' });
        if (list && list.keys) {
          for (const key of list.keys) {
            await env.CACHE.delete(key.name);
          }
        }
      } catch (cacheErr) {
        console.warn('[admin/blog] Chyba při invalidaci KV cache:', cacheErr.message);
      }
    }

    return json({ ok: true, data: { id, status: action === 'publish' ? 'published' : action === 'schedule' ? 'scheduled' : action === 'unpublish' ? 'draft' : action === 'archive' ? 'archived' : post.status } });
  } catch (err) {
    console.error('[admin/blog] PUT error:', err);
    return json({ ok: false, error: 'Chyba při zpracování akce.' }, 500);
  }
}
