// Cron: Auto-publish scheduled blog posts (runs hourly alongside reminders)
// Schedule: 0 */1 * * *
// Checks for posts with status = 'scheduled' where published_at <= datetime('now') and publishes them.

export default {
  async scheduled(event, env, ctx) {
    try {
      // 1. Vybrat naplánované články, které mají být zveřejněny
      const { results: posts } = await env.DB.prepare(
        `SELECT id, title FROM blog_posts 
         WHERE status = 'scheduled' AND published_at <= datetime('now')`
      ).all();

      if (!posts || posts.length === 0) {
        return;
      }

      console.log(`[cron-blog-publish] Nalezeno ${posts.length} článků k automatické publikaci`);

      const batch = [];
      const now = new Date().toISOString();

      // Změna statusu na 'published'
      batch.push(
        env.DB.prepare(
          `UPDATE blog_posts 
           SET status = 'published', updated_at = datetime('now')
           WHERE status = 'scheduled' AND published_at <= datetime('now')`
        )
      );

      // Přidání audit logů
      for (const post of posts) {
        batch.push(
          env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'blog_posts', ?, 'update', 'cron', ?)`
          ).bind(crypto.randomUUID(), post.id, `Auto-published: ${post.title}`)
        );
      }

      // Spustit transakci
      await env.DB.batch(batch);

      // 2. Invalidovat KV cache (smazat všechny klíče začínající 'blog:published:')
      try {
        const list = await env.CACHE.list({ prefix: 'blog:published:' });
        if (list && list.keys) {
          for (const key of list.keys) {
            await env.CACHE.delete(key.name);
          }
          console.log(`[cron-blog-publish] Invalidováno ${list.keys.length} cache klíčů`);
        }
      } catch (cacheErr) {
        console.warn('[cron-blog-publish] Nepodařilo se invalidovat KV cache:', cacheErr.message);
      }

      console.log(`[cron-blog-publish] Úspěšně automaticky publikováno ${posts.length} článků`);
    } catch (err) {
      console.error('[cron-blog-publish] Neočekávaná chyba při publikování:', err);
    }
  }
};
