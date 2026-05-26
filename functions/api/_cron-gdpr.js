// Cron: GDPR anonymization (daily at 03:30)
// Schedule: 30 3 * * *
// Anonymizes bookings older than 30 days after preferred_date.

export default {
  async scheduled(event, env, ctx) {
    const config = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'gdpr_anonymizer_status'"
    ).first();
    if (config?.value !== 'active') return;

    // Anonymize bookings where preferred_date is 30+ days ago
    // and not already anonymized
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    const thresholdISO = threshold.toISOString();

    const result = await env.DB.prepare(
      `UPDATE bookings
       SET name_enc = NULL,
           email_enc = NULL,
           phone_enc = NULL,
           note_enc = NULL,
           anonymized_at = CURRENT_TIMESTAMP
       WHERE preferred_date <= ?
       AND anonymized_at IS NULL
       AND status IN ('done', 'cancelled')`
    ).bind(thresholdISO).run();

    const anonymizedCount = result?.meta?.changes || 0;

    if (anonymizedCount > 0) {
      // Audit log
      await env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'bookings', NULL, 'anonymize', 'cron', ?)`
      ).bind(crypto.randomUUID(), `Anonymized ${anonymizedCount} bookings older than 30 days`).run();

      console.log(`[cron-gdpr] Anonymized ${anonymizedCount} bookings`);
    }
  },
};
