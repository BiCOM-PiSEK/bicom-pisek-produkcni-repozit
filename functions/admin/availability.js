/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Availability API (F3)
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/availability — načti otevírací dobu + booking_settings
 * PUT  /admin/availability — ulož pravidla a nastavení s validací
 *
 * Kritical: časy "HH:MM" s vedoucí nulou, guard proti nevalidním slotům
 * ═══════════════════════════════════════════════════════════════
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function onRequestGet({ env, data }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const rulesRes = await env.DB.prepare(
      'SELECT id, weekday, start_time, end_time, active FROM availability_rules ORDER BY weekday'
    ).all();

    const settingsRes = await env.DB.prepare(
      'SELECT slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days, require_confirmation, require_deposit, deposit_amount FROM booking_settings WHERE id = 1'
    ).first();

    const rules = rulesRes?.results || [];
    const settings = settingsRes || {
      slot_duration_min: 60,
      slot_gap_min: 10,
      min_lead_hours: 24,
      max_horizon_days: 60,
      require_confirmation: 1,
      require_deposit: 0,
      deposit_amount: null,
    };

    return json({
      ok: true,
      data: { rules, settings },
    });
  } catch (err) {
    console.error('[admin/availability] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání dostupnosti.' }, 500);
  }
}

export async function onRequestPut({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  // Role check
  if (data.operator.role !== 'admin' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění.' }, 403);
  }

  try {
    const body = await request.json();
    const { rules = [], settings = {} } = body;

    // ─── VALIDACE PRAVIDEL ───────────────────────────────────

    if (!Array.isArray(rules)) {
      return json({ ok: false, error: 'Pole "rules" musí být pole.' }, 400);
    }

    const seenWeekdays = new Set();
    const validatedRules = [];

    for (const rule of rules) {
      const { weekday, start_time, end_time, active = 1 } = rule;

      // Weekday validation
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return json({
          ok: false,
          error: `Neplatný weekday: ${weekday}. Musí být 0–6.`,
        }, 400);
      }

      if (seenWeekdays.has(weekday)) {
        return json({
          ok: false,
          error: `Weekday ${weekday} je duplicitní. Každý den jen jednou.`,
        }, 400);
      }
      seenWeekdays.add(weekday);

      // Time validation
      if (!TIME_REGEX.test(start_time)) {
        return json({
          ok: false,
          error: `start_time "${start_time}" není ve formátu HH:MM (s vedoucí nulou).`,
        }, 400);
      }

      if (!TIME_REGEX.test(end_time)) {
        return json({
          ok: false,
          error: `end_time "${end_time}" není ve formátu HH:MM (s vedoucí nulou).`,
        }, 400);
      }

      if (start_time >= end_time) {
        return json({
          ok: false,
          error: `start_time "${start_time}" musí být < end_time "${end_time}".`,
        }, 400);
      }

      // Active validation
      if (![0, 1].includes(active)) {
        return json({
          ok: false,
          error: `active musí být 0 nebo 1, dostano: ${active}.`,
        }, 400);
      }

      validatedRules.push({
        id: `rule_${weekday}_${Math.random().toString(36).slice(2, 10)}`,
        weekday,
        start_time,
        end_time,
        active,
      });
    }

    // ─── VALIDACE SETTINGS ───────────────────────────────────

    const {
      slot_duration_min,
      slot_gap_min,
      min_lead_hours,
      max_horizon_days,
      require_confirmation,
      require_deposit,
      deposit_amount,
    } = settings;

    // slot_duration_min > 0
    if (slot_duration_min != null) {
      if (!Number.isInteger(slot_duration_min) || slot_duration_min <= 0) {
        return json({
          ok: false,
          error: `slot_duration_min musí být > 0, dostano: ${slot_duration_min}.`,
        }, 400);
      }
    }

    // slot_gap_min >= 0
    if (slot_gap_min != null) {
      if (!Number.isInteger(slot_gap_min) || slot_gap_min < 0) {
        return json({
          ok: false,
          error: `slot_gap_min musí být >= 0, dostano: ${slot_gap_min}.`,
        }, 400);
      }
    }

    // Kontrola (duration + gap) > 0
    const finalDuration = slot_duration_min ?? 60;
    const finalGap = slot_gap_min ?? 10;
    if (finalDuration + finalGap <= 0) {
      return json({
        ok: false,
        error: `slot_duration_min + slot_gap_min musí být > 0, dostano: ${finalDuration} + ${finalGap} = ${finalDuration + finalGap}.`,
      }, 400);
    }

    // min_lead_hours >= 0
    if (min_lead_hours != null) {
      if (!Number.isInteger(min_lead_hours) || min_lead_hours < 0) {
        return json({
          ok: false,
          error: `min_lead_hours musí být >= 0, dostano: ${min_lead_hours}.`,
        }, 400);
      }
    }

    // max_horizon_days > 0
    if (max_horizon_days != null) {
      if (!Number.isInteger(max_horizon_days) || max_horizon_days <= 0) {
        return json({
          ok: false,
          error: `max_horizon_days musí být > 0, dostano: ${max_horizon_days}.`,
        }, 400);
      }
    }

    // require_confirmation, require_deposit: 0/1
    if (require_confirmation != null && ![0, 1].includes(require_confirmation)) {
      return json({
        ok: false,
        error: `require_confirmation musí být 0 nebo 1, dostano: ${require_confirmation}.`,
      }, 400);
    }

    if (require_deposit != null && ![0, 1].includes(require_deposit)) {
      return json({
        ok: false,
        error: `require_deposit musí být 0 nebo 1, dostano: ${require_deposit}.`,
      }, 400);
    }

    // deposit_amount >= 0 nebo null
    if (deposit_amount != null) {
      if (!Number.isInteger(deposit_amount) || deposit_amount < 0) {
        return json({
          ok: false,
          error: `deposit_amount musí být >= 0 nebo null, dostano: ${deposit_amount}.`,
        }, 400);
      }
    }

    // ─── ZÁPIS (BATCH TRANSACTION) ───────────────────────────

    const batch = [];

    // 1. Delete old rules
    batch.push(env.DB.prepare('DELETE FROM availability_rules'));

    // 2. Insert new rules
    for (const rule of validatedRules) {
      batch.push(
        env.DB.prepare(
          'INSERT INTO availability_rules (id, weekday, start_time, end_time, active) VALUES (?, ?, ?, ?, ?)'
        ).bind(rule.id, rule.weekday, rule.start_time, rule.end_time, rule.active)
      );
    }

    // 3. Upsert booking_settings (ensure row exists, then update)
    batch.push(
      env.DB.prepare(
        `INSERT INTO booking_settings
          (id, slot_duration_min, slot_gap_min, min_lead_hours,
           max_horizon_days, require_confirmation, require_deposit, deposit_amount)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slot_duration_min = excluded.slot_duration_min,
           slot_gap_min = excluded.slot_gap_min,
           min_lead_hours = excluded.min_lead_hours,
           max_horizon_days = excluded.max_horizon_days,
           require_confirmation = excluded.require_confirmation,
           require_deposit = excluded.require_deposit,
           deposit_amount = excluded.deposit_amount`
      ).bind(
        slot_duration_min,
        slot_gap_min,
        min_lead_hours,
        max_horizon_days,
        require_confirmation,
        require_deposit,
        deposit_amount
      )
    );

    // 4. Audit log
    const changesSummary = `${validatedRules.length} pravidel (weekdays: ${validatedRules.map(r => r.weekday).join(',') || 'žádné'})`;
    batch.push(
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'availability_rules', 'global', 'update', ?, ?)`
      ).bind(crypto.randomUUID(), `operator:${data.operator.id}`, changesSummary)
    );

    // Execute batch
    await env.DB.batch(batch);

    return json({
      ok: true,
      updated: validatedRules.length,
      message: `Dostupnost uložena: ${validatedRules.length} pravidel, nastavení aktualizováno.`,
    });
  } catch (err) {
    console.error('[admin/availability] PUT error:', err);
    return json({ ok: false, error: 'Chyba při ukládání dostupnosti.' }, 500);
  }
}
