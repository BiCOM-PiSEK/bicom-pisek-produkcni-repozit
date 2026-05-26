// Cron: D1 database backup to R2 (weekly, Sunday 02:00)
// Schedule: 0 2 * * 0
// Exports all tables to JSON and stores in R2 backups/ folder.
// Retention: 8 weeks (oldest backups auto-deleted).

export default {
  async scheduled(event, env, ctx) {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tables = [
      'bookings', 'newsletter_subscribers', 'blog_posts', 'services',
      'geo_leads', 'reminders', 'audit_log', 'operators',
      'calendar_slots', 'social_posts', 'marketing_campaigns',
      'content_blocks', 'process_states',
    ];

    const backup = {};
    let totalRows = 0;

    for (const table of tables) {
      try {
        const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = results || [];
        totalRows += backup[table].length;
      } catch (err) {
        console.error(`[cron-backup] Failed to export ${table}:`, err);
        backup[table] = { error: err.message };
      }
    }

    // Save to R2
    const backupKey = `backups/d1-backup-${timestamp}.json`;
    await env.MEDIA.put(backupKey, JSON.stringify(backup, null, 2), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { tables: tables.length.toString(), rows: totalRows.toString() },
    });

    // Clean up backups older than 8 weeks
    try {
      const { objects } = await env.MEDIA.list({ prefix: 'backups/d1-backup-' });
      if (objects?.length > 8) {
        // Sort by key (date-based naming ensures chronological order)
        const sorted = objects.sort((a, b) => a.key.localeCompare(b.key));
        const toDelete = sorted.slice(0, sorted.length - 8);
        for (const obj of toDelete) {
          await env.MEDIA.delete(obj.key);
          console.log(`[cron-backup] Deleted old backup: ${obj.key}`);
        }
      }
    } catch (err) {
      console.error('[cron-backup] Cleanup failed:', err);
    }

    // Audit log
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'system', NULL, 'export', 'cron', ?)`
    ).bind(crypto.randomUUID(), `D1 backup: ${totalRows} rows across ${tables.length} tables → R2 ${backupKey}`).run();

    console.log(`[cron-backup] Backup complete: ${totalRows} rows → ${backupKey}`);
  },
};
