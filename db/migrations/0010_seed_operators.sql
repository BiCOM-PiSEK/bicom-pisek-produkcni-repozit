-- Migration 0010: seed real operators + remove phantoms

-- 0) Uvolnění referencí cizích klíčů na fantomy
UPDATE bookings SET operator_id = NULL WHERE operator_id IN ('op_lenka', 'op_admin');
UPDATE calendar_slots SET operator_id = NULL WHERE operator_id IN ('op_lenka', 'op_admin');
UPDATE social_posts SET created_by = NULL WHERE created_by IN ('op_lenka', 'op_admin');

-- 1) Odstranění dvou fantomových řádků
DELETE FROM operators WHERE id IN ('op_lenka', 'op_admin');
DELETE FROM operators WHERE email IN ('lenka@bicom-pisek.cz', 'admin@meverik.studio');

-- 2) Vložení 6 reálných identit
INSERT OR IGNORE INTO operators (id, name, email, role, active, calendar_color) VALUES
('op_jana', 'Jana', 'jana@bicom-pisek.cz', 'owner', 1, '#738A75'),
('op_tereza', 'Tereza', 'tereza@bicom-pisek.cz', 'owner', 1, '#C5A880'),
('op_admin_box', 'Admin', 'admin@bicom-pisek.cz', 'admin', 1, '#3A4A3C'),
('op_info', 'Info', 'info@bicom-pisek.cz', 'admin', 1, NULL),
('op_matej_ic', 'Matěj Kocanda', 'matejkocanda@icloud.com', 'admin', 1, NULL),
('op_matej_gm', 'Matěj Kocanda', 'kocanda.matej@gmail.com', 'admin', 1, NULL);
