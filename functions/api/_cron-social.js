// Cron: Social media post scheduler (daily at 08:00)
// Schedule: 0 8 * * *
// Publishes scheduled social posts by enqueueing them to social-jobs.

export default {
  async scheduled(event, env, ctx) {
    const now = new Date().toISOString();

    // Find posts scheduled for publishing
    const { results: posts } = await env.DB.prepare(
      `SELECT * FROM social_posts
       WHERE status = 'scheduled'
       AND publish_at <= ?
       LIMIT 20`
    ).bind(now).all();

    if (!posts?.length) return;

    for (const post of posts) {
      try {
        // Enqueue for async publishing
        await env.SOCIAL_QUEUE.send({
          id: post.id,
          content_text: post.content_text,
          media_url: post.media_url,
          platform: post.platform,
          utm_source: post.utm_source,
          utm_campaign: post.utm_campaign,
        });

        console.log(`[cron-social] Enqueued post ${post.id} for publishing`);
      } catch (err) {
        console.error(`[cron-social] Failed to enqueue post ${post.id}:`, err);
      }
    }

    console.log(`[cron-social] Enqueued ${posts.length} posts for publishing`);
  },
};
