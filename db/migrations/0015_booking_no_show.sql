-- Migration 0015: no_show ("klient nedorazil") — ADR-005, varianta (b)
-- Boolean příznak místo nové hodnoty v CHECK(status) — bezpečné ALTER ADD COLUMN
-- (REBUILD tabulky bookings s ostrými daty by byl nepoměrné riziko).
-- Sémantika: confirmed → done + no_show_flag=1.

ALTER TABLE bookings ADD COLUMN no_show_flag INTEGER DEFAULT 0;
