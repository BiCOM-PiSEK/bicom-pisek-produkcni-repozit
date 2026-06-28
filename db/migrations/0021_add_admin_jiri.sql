-- Migration 0021: Add Jiří Limpouch as full admin (2026-06-22)
-- ─────────────────────────────────────────────────────────────
-- Přidání Jiřího Limpoukha z AGroup do admin konzole
-- Role: admin, Active: 1
-- Calendar: None (bude nastaveno později, pokud třeba)

-- BEGIN;

INSERT OR IGNORE INTO operators (id, name, email, role, active, calendar_color) VALUES
('op_jiri_limpouch', 'Jiří Limpouch', 'jiri.limpouch@alettgroup.cz', 'admin', 1, NULL);

-- COMMIT;
