// Cron: Instagram sync (daily at 03:00)
// Schedule: 0 3 * * *
// Fetches new posts from Instagram via Meta Graph API,
// saves images to R2 and creates blog_posts entries.

import { fetchWithRetry } from '../lib/connectors/_fetch-retry.js';

export default {
  async scheduled(event, env, ctx) {
    const config = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'instagram_sync_status'"
    ).first();
    if (config?.value !== 'active') return;

    const accessToken = env.SECRET_META_GRAPH_ACCESS_TOKEN;
    const igUserId = env.SECRET_META_IG_USER_ID;

    if (!accessToken || !igUserId) {
      console.log('[cron-instagram] Missing Meta Graph API credentials, skipping');
      return;
    }

    try {
      // Fetch recent media from Instagram
      const res = await fetchWithRetry(
        `https://graph.instagram.com/v18.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${accessToken}&limit=10`
      );

      if (!res.ok) {
        console.error(`[cron-instagram] API error: ${res.status}`);
        return;
      }

      const { data: posts } = await res.json();
      if (!posts?.length) return;

      let syncedCount = 0;

      for (const post of posts) {
        // Skip non-image posts (reels, carousels handled later)
        if (post.media_type !== 'IMAGE' && post.media_type !== 'CAROUSEL_ALBUM') continue;

        // Check if already synced (by slug = ig-{id})
        const slug = `ig-${post.id}`;
        const existing = await env.DB.prepare(
          'SELECT id FROM blog_posts WHERE slug = ?'
        ).bind(slug).first();

        if (existing) continue;

        // Download image and save to R2
        let imageUrl = null;
        const mediaUrl = post.media_url || post.thumbnail_url;
        if (mediaUrl) {
          try {
            const imgRes = await fetch(mediaUrl);
            if (imgRes.ok) {
              const imgBuffer = await imgRes.arrayBuffer();
              const r2Key = `blog/${slug}.jpg`;
              await env.MEDIA.put(r2Key, imgBuffer, {
                httpMetadata: { contentType: 'image/jpeg' },
              });
              imageUrl = `/media/${r2Key}`;
            }
          } catch (err) {
            console.error(`[cron-instagram] Failed to save image for ${slug}:`, err);
          }
        }

        // Create blog post from Instagram caption
        const caption = post.caption || '';
        const title = caption.substring(0, 80).split('\n')[0] || 'Příspěvek z Instagramu';
        const excerpt = caption.substring(0, 160);

        await env.DB.prepare(
          `INSERT INTO blog_posts (id, slug, title, excerpt, content, image_url, source, status, published_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'instagram', 'draft', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          slug,
          title,
          excerpt,
          caption,
          imageUrl,
          post.timestamp,
          new Date().toISOString()
        ).run();

        syncedCount++;
      }

      if (syncedCount > 0) {
        await env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'blog_posts', NULL, 'create', 'cron', ?)`
        ).bind(crypto.randomUUID(), `Instagram sync: ${syncedCount} new posts`).run();
      }

      console.log(`[cron-instagram] Synced ${syncedCount} new posts from Instagram`);
    } catch (err) {
      console.error('[cron-instagram] Sync failed:', err);
    }
  },
};
