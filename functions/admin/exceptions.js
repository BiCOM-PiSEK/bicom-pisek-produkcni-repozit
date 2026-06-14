/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin Exceptions API (F4)
 * ═══════════════════════════════════════════════════════════════
 * GET  /admin/exceptions — načti výjimky dostupnosti
 * POST /admin/exceptions — přidej výjimku (svátek/dovolenou/ad-hoc/extra)
 * DELETE /admin/exceptions?id=... — smaž výjimku
 *
 * Types: holiday | vacation (celý den) | adhoc | extra (s časy)
 * ═══════════════════════════════════════════════════════════════
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export async function onRequestGet({ env, data }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    const res = await env.DB.prepare(
      `SELECT id, date, start_time, end_time, type, note, created_at
       FROM availability_exceptions
       WHERE date >= ?
       ORDER BY date ASC`
    ).bind(todayStr).all();

    const exceptions = res?.results || [];

    return json({
      ok: true,
      data: { exceptions },
    });
  } catch (err) {
    console.error('[admin/exceptions] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání výjimek.' }, 500);
  }
}

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  // Role check
  if (data.operator.role !== 'admin' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění.' }, 403);
  }

  try {
    const body = await request.json();
    const { date, type, start_time, end_time, note } = body;

    // ─── VALIDACE ───────────────────────────────────────────────

    if (!date) {
      return json({ ok: false, error: 'Datum je povinné.' }, 400);
    }

    if (!DATE_REGEX.test(date)) {
      return json({
        ok: false,
        error: `Datum musí být ve formátu YYYY-MM-DD, dostano: ${date}.`,
      }, 400);
    }

    // Ověř, že je to reálné datum
    const parsed = parseDate(date);
    if (formatDate(parsed) !== date) {
      return json({
        ok: false,
        error: `Neplatné datum: ${date}. (Např. 2026-02-31 neexistuje.)`,
      }, 400);
    }

    if (!type || !['holiday', 'vacation', 'adhoc', 'extra'].includes(type)) {
      return json({
        ok: false,
        error: `Typ musí být holiday, vacation, adhoc nebo extra, dostano: ${type}.`,
      }, 400);
    }

    // Holiday/vacation MUSÍ mít časy null
    if ((type === 'holiday' || type === 'vacation') && (start_time || end_time)) {
      return json({
        ok: false,
        error: `Typ "${type}" (celý den) nesmí mít časy. Vynechte start_time a end_time.`,
      }, 400);
    }

    // Adhoc/extra MUSÍ mít časy
    if ((type === 'adhoc' || type === 'extra') && (!start_time || !end_time)) {
      return json({
        ok: false,
        error: `Typ "${type}" vyžaduje start_time a end_time.`,
      }, 400);
    }

    // Pokud jsou časy, validuj je
    if (start_time || end_time) {
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
    }

    // Note: volitelný, max 200 znaků
    const cleanNote = note
      ? note.substring(0, 200).trim()
      : null;

    // ─── ZÁPIS ──────────────────────────────────────────────────

    const exceptionId = `exc_${crypto.randomUUID().slice(0, 8)}`;

    await env.DB.prepare(
      `INSERT INTO availability_exceptions (id, date, start_time, end_time, type, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(exceptionId, date, start_time || null, end_time || null, type, cleanNote).run();

    // Audit log
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'availability_exceptions', 'global', 'create', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `operator:${data.operator.id}`,
      `typ=${type}, datum=${date}`
    ).run();

    return json({
      ok: true,
      id: exceptionId,
      message: `Výjimka přidána: ${date} (${type}).`,
    }, 201);
  } catch (err) {
    console.error('[admin/exceptions] POST error:', err);
    return json({ ok: false, error: 'Chyba při vytváření výjimky.' }, 500);
  }
}

export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  // Role check
  if (data.operator.role !== 'admin' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění.' }, 403);
  }

  try {
    // Get ID from query string or body
    const url = new URL(request.url);
    const idFromQuery = url.searchParams.get('id');

    let id = idFromQuery;

    if (!idFromQuery) {
      const body = await request.json();
      id = body.id;
    }

    if (!id) {
      return json({ ok: false, error: 'ID výjimky je povinné.' }, 400);
    }

    // Ověř že existuje
    const existing = await env.DB.prepare(
      'SELECT id FROM availability_exceptions WHERE id = ?'
    ).bind(id).first();

    if (!existing) {
      return json({ ok: false, error: 'Výjimka nenalezena.' }, 404);
    }

    // Delete
    await env.DB.prepare(
      'DELETE FROM availability_exceptions WHERE id = ?'
    ).bind(id).run();

    // Audit log
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'availability_exceptions', 'global', 'delete', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `operator:${data.operator.id}`,
      `id=${id}`
    ).run();

    return json({
      ok: true,
      message: 'Výjimka smazána.',
    });
  } catch (err) {
    console.error('[admin/exceptions] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání výjimky.' }, 500);
  }
}
