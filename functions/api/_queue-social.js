// Queue consumer: social-jobs
// Publishes approved social media posts with UTM tracking.

/**
 * Queue consumer for social-jobs.
 * Each message contains a social post to publish.
 * @param {MessageBatch} batch
 * @param {Object} env
 */
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const post = message.body;

        // For now, Telegram is the primary social channel
        // Instagram/Facebook publishing will be added when Meta Graph API is configured
        if (post.platform === 'telegram' || !post.platform) {
          const { TelegramConnector } = await import('../lib/connectors/telegram.js');
          const telegram = new TelegramConnector(env);

          // Append UTM link if campaign URL exists
          let text = post.content_text;
          if (post.utm_source && post.utm_campaign) {
            const utmUrl = `https://bicompisek.cz?utm_source=${post.utm_source}&utm_campaign=${post.utm_campaign}`;
            text += `\n\n🔗 ${utmUrl}`;
          }

          await telegram.sendMessage(text);
        }

        // Update post status in D1
        await env.DB.prepare(
          `UPDATE social_posts SET status = 'published' WHERE id = ?`
        ).bind(post.id).run();

        // Audit log
        await env.DB.prepare(
          `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
           VALUES (?, 'social_posts', ?, 'update', 'system', 'Published via queue')`
        ).bind(crypto.randomUUID(), post.id).run();

        message.ack();
      } catch (err) {
        console.error(`[queue-social] Error publishing post ${message.body?.id}:`, err);

        // Mark as failed after 3 retries
        if (message.attempts >= 3) {
          await env.DB.prepare(
            `UPDATE social_posts SET status = 'failed' WHERE id = ?`
          ).bind(message.body?.id).run();
          message.ack();
        } else {
          message.retry({ delaySeconds: 60 });
        }
      }
    }
  },
};
