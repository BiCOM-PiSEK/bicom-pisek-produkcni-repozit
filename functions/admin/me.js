/**
 * BICOM PÍSEK — Admin Operator Identity API
 * GET /admin/me — vrátí profil přihlášené operátorky
 */

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ data }) {
  const operator = data.operator;
  if (!operator) {
    return json({ ok: false, error: 'Neoprávněný přístup' }, 401);
  }

  const result = {};
  if (operator.id !== undefined) result.id = operator.id;
  if (operator.name !== undefined) result.name = operator.name;
  if (operator.email !== undefined) result.email = operator.email;
  if (operator.role !== undefined) result.role = operator.role;

  return json({
    ok: true,
    data: {
      operator: result
    }
  });
}
