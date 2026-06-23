// functions/_middleware.js
// Global middleware — passthrough. Maintenance mode odstraněn po v1.0 launch (2026-06-23).
// Admin autorizace je řízena separátně v functions/admin/_middleware.js.

export async function onRequest(context) {
  return context.next();
}
