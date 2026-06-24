-- Migration 0026: Ensure Jiří Limpouch operator account is active in production.
-- Two-step upsert: idempotent regardless of whether migration 0021 was previously applied.

INSERT OR IGNORE INTO operators (id, name, email, role, active, calendar_color)
VALUES ('op_jiri_limpouch', 'Jiří Limpouch', 'jiri.limpouch@alettgroup.cz', 'admin', 1, NULL);

UPDATE operators
SET name = 'Jiří Limpouch', role = 'admin', active = 1
WHERE email = 'jiri.limpouch@alettgroup.cz';