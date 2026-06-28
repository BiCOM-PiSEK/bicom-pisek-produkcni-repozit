/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Chat Messages Admin API
 * ═══════════════════════════════════════════════════════════════
 * GET    /admin/messages                   — přehled všech konverzací
 * GET    /admin/messages?conversation_id=  — detail konverzace (zprávy)
 * DELETE /admin/messages?conversation_id=  — smazání konverzace
 * ═══════════════════════════════════════════════════════════════
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversation_id');

  try {
    // 1. Detail konkrétní konverzace
    if (conversationId) {
      const { results } = await env.DB.prepare(
        `SELECT id, role, message, created_at
         FROM chat_messages
         WHERE conversation_id = ?
         ORDER BY created_at ASC`
      ).bind(conversationId).all();

      return json({
        ok: true,
        data: {
          conversation_id: conversationId,
          messages: results || [],
        },
      });
    }

    // 2. Přehled všech konverzací (agregovaný)
    // Získáme unikátní conversation_id, počet zpráv v ní, text poslední zprávy a datum poslední zprávy
    const { results } = await env.DB.prepare(
      `SELECT 
         m.conversation_id,
         COUNT(m.id) as message_count,
         (SELECT message FROM chat_messages WHERE conversation_id = m.conversation_id ORDER BY created_at DESC LIMIT 1) as last_message,
         MAX(m.created_at) as last_message_at
       FROM chat_messages m
       GROUP BY m.conversation_id
       ORDER BY last_message_at DESC`
    ).all();

    return json({
      ok: true,
      data: {
        conversations: results || [],
      },
    });

  } catch (err) {
    console.error('[admin/messages] GET error:', err);
    return json({ ok: false, error: 'Chyba při načítání zpráv.' }, 500);
  }
}

export async function onRequestDelete({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversation_id');

  if (!conversationId) {
    return json({ ok: false, error: 'Chybí parametr conversation_id.' }, 400);
  }

  try {
    // Smazání konverzace z DB
    const res = await env.DB.prepare(
      `DELETE FROM chat_messages WHERE conversation_id = ?`
    ).bind(conversationId).run();

    const changes = res?.meta?.changes || 0;

    // Zápis do audit logu
    await env.DB.prepare(
      `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
       VALUES (?, 'chat', ?, 'delete', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      conversationId,
      `operator:${data.operator.id}`,
      `Smazána chatová konverzace (odstraněno ${changes} zpráv)`
    ).run();

    return json({
      ok: true,
      data: {
        conversation_id: conversationId,
        deleted_count: changes,
      },
    });

  } catch (err) {
    console.error('[admin/messages] DELETE error:', err);
    return json({ ok: false, error: 'Chyba při mazání konverzace.' }, 500);
  }
}
