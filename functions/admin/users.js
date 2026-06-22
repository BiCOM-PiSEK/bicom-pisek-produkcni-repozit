/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin User Management API (Admin Only)
 * ═══════════════════════════════════════════════════════════════
 * POST /admin/users — Add new admin user (owner/admin role only)
 *
 * Body:
 * {
 *   "email": "user@example.com",
 *   "name": "User Name",
 *   "role": "admin|owner",
 *   "sendWelcome": true
 * }
 * ═══════════════════════════════════════════════════════════════
 */

import { ResendConnector } from '../lib/connectors/resend.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ env, data, request }) {
  // Only admins can manage users
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  if (data.operator.role !== 'admin' && data.operator.role !== 'owner' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění — pouze admin/owner.' }, 403);
  }

  try {
    const body = await request.json();
    const { email, name, role = 'admin', sendWelcome = true } = body;

    // Validation
    if (!email || !name) {
      return json({ ok: false, error: 'Email a jméno jsou povinné.' }, 400);
    }

    if (!['admin', 'owner'].includes(role)) {
      return json({ ok: false, error: 'Role musí být admin nebo owner.' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const sanitizedName = String(name).slice(0, 100);
    const userId = `op_${sanitizedName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '')}`;

    // Check if user already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM operators WHERE email = ? COLLATE NOCASE'
    ).bind(normalizedEmail).first();

    if (existing) {
      return json({ ok: false, error: 'Uživatel s tímto e-mailem již existuje.' }, 409);
    }

    // Add user to database
    await env.DB.prepare(
      `INSERT INTO operators (id, email, name, role, active, created_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
    ).bind(userId, normalizedEmail, sanitizedName, role).run();

    // Send welcome email if requested
    if (sendWelcome) {
      const resend = new ResendConnector(env);
      await resend.sendAdminWelcome({
        email: normalizedEmail,
        name: sanitizedName,
      });
    }

    return json({
      ok: true,
      data: {
        id: userId,
        email: normalizedEmail,
        name: sanitizedName,
        role,
        message: `Uživatel ${sanitizedName} byl přidán. ${sendWelcome ? 'Welcome email odeslán.' : ''}`,
      },
    }, 201);

  } catch (err) {
    console.error('[admin/users] POST error:', err);
    return json({ ok: false, error: 'Chyba při přidávání uživatele.', details: err.message }, 500);
  }
}

// GET — list all operators (admin only)
export async function onRequestGet({ env, data }) {
  if (!data.operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  if (data.operator.role !== 'admin' && data.operator.role !== 'owner' && !data.operator.isDev) {
    return json({ ok: false, error: 'Nedostatečná oprávnění' }, 403);
  }

  try {
    const result = await env.DB.prepare(
      'SELECT id, email, name, role, active, created_at FROM operators ORDER BY created_at DESC'
    ).all();

    return json({
      ok: true,
      data: {
        operators: result?.results || [],
      },
    });
  } catch (err) {
    console.error('[admin/users] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání operátorů.' }, 500);
  }
}
