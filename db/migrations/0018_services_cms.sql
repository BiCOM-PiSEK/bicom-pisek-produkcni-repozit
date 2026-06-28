-- ============================================================
-- Migration 0018: CMS služby (icon_url) + texty homepage karet (F12-F2)
-- ============================================================
-- Zdroj pravdy = db/schema.sql; tato migrace je inkrementální krok 0018.
--
-- Run (local):  wrangler d1 execute DB --local  --file=db/migrations/0018_services_cms.sql
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0018_services_cms.sql

-- ── 1) SLUŽBY: ikona ────────────────────────────────────────
-- BEGIN;
  ALTER TABLE services ADD COLUMN icon_url TEXT;
  -- Naseedovat cesty k ikonám z konvence /assets/img/icons/icon-<slug>.webp
  UPDATE services SET icon_url = '/assets/img/icons/icon-' || slug || '.webp'
  WHERE icon_url IS NULL OR icon_url = '';
-- COMMIT;

-- ── 2) TEXTY HOMEPAGE KARET (config JSON, type 'config') ────
-- Info-karty „Jak funguje" (3) a cert-karty „Důvěra a Bezpečí" (3).
-- SVG ikony zůstávají v HTML; CMS plní jen title + text dle pořadí.
INSERT OR IGNORE INTO content_blocks (id, section_key, title, content_markdown, content_type) VALUES
  (lower(hex(randomblob(8))), 'home-jakfunguje-cards', 'Jak funguje – karty',
   '[{"title":"Certifikovaný prostředek","text":"Bicom Optima je v EU schválen jako zdravotnický prostředek třídy IIa. Splňuje normy ISO 13485 pro bezpečnost a kvalitu."},{"title":"Bezbolestné & Neinvazivní","text":"Metoda je zcela bezbolestná. Během sezení klidně odpočíváte v křesle, což je ideální i pro velmi malé děti nebo citlivé jedince."},{"title":"Osobní & Komplementární","text":"Každému klientovi věnujeme plnou pozornost. Nenahrazujeme lékaře, ale fungujeme jako šetrný doplněk klasické medicíny."}]',
   'config'),
  (lower(hex(randomblob(8))), 'home-cert-cards', 'Důvěra a bezpečí – karty',
   '[{"title":"ISO 13485","text":"Výroba přístrojů Bicom podléhá nejpřísnějším mezinárodním certifikacím řízení kvality pro zdravotnické prostředky."},{"title":"Odborná certifikace","text":"Naše terapeutky jsou certifikovanými praktiky metody Bicom s rozsáhlým odborným školením v České republice."},{"title":"GDPR Compliance","text":"Osobní a citlivé údaje šifrujeme na úrovni databáze (field-level encryption) a zpracováváme v souladu s GDPR."}]',
   'config');

-- ============================================================
-- Done — migrace 0018
-- ============================================================
