/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Settings API
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/settings — načti aktuální konfiguraci
 * PUT  /admin/settings — ulož změny
 *
 * Konfigurace je uložena v tabulce `process_states` (key-value).
 * Umožňuje majitelkám měnit chování systému bez deploye.
 * ═══════════════════════════════════════════════════════════════
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const EDITABLE_KEYS = [
  'invoice_mode',       // 'auto_confirm' | 'manual' | 'after_visit'
  'reminder_sms',       // '1' | '0'
  'reminder_email',     // '1' | '0'
  'reminder_hours',     // hours before appointment (default 24)
  'telegram_booking',   // '1' | '0' — send booking notifications
  'telegram_digest',    // '1' | '0' — weekly digest
  'telegram_cashflow',  // '1' | '0' — cashflow alerts
  'ai_copywriter_tone', // 'formal' | 'friendly' | 'quiet_luxury'
  'ai_auto_publish',    // '1' | '0' — auto-publish AI articles
  'ai_legal_guardrail', // 'off' | 'mild' | 'optimal' | 'strict'
  'gdpr_retention_days', // number of days before anonymization
  'booking_max_future_days', // max days in advance for bookings
  'stripe_deposit_required', // '1' | '0' — whether Stripe deposit is mandatory
  'require_phone',      // '1' | '0' — whether phone number is mandatory for booking
];

export async function onRequestGet({ env, data }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const result = await env.DB.prepare(
      'SELECT key, value, updated_at FROM process_states'
    ).all();

    const settings = {};
    for (const row of result?.results || []) {
      settings[row.key] = {
        value: row.value,
        updated_at: row.updated_at,
      };
    }

    return json({ ok: true, data: { settings } });
  } catch (err) {
    console.error('[admin/settings] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání nastavení.' }, 500);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  // Only admins can change settings
  if (data.operator.role !== 'admin' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění.' }, 403);
  }

  try {
    const body = await request.json();
    const updates = body.settings || body;

    if (!updates || typeof updates !== 'object') {
      return json({ ok: false, error: 'Neplatný formát dat.' }, 400);
    }

    const now = new Date().toISOString();
    const batch = [];

    for (const [key, value] of Object.entries(updates)) {
      // Only allow known keys
      if (!EDITABLE_KEYS.includes(key)) {
        continue;
      }

      // Sanitize value
      const cleanValue = String(value).slice(0, 500);

      batch.push(
        env.DB.prepare(
          `INSERT INTO process_states (key, value, updated_at)
           VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`
        ).bind(key, cleanValue, now, cleanValue, now)
      );
    }

    if (batch.length > 0) {
      await env.DB.batch(batch);

      // Audit log
      await env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor)
         VALUES (?, 'settings', 'global', 'update', ?)`
      ).bind(crypto.randomUUID(), `operator:${data.operator.id}`).run();
    }

    return json({ ok: true, updated: batch.length });
  } catch (err) {
    console.error('[admin/settings] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání nastavení.' }, 500);
  }
}
