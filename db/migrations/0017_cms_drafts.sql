-- ============================================================
-- Migration 0017: CMS draft/publish vrstva + rozšíření obsahu (F12-F1)
-- ============================================================
-- Zdroj pravdy pro strukturu DB je `db/schema.sql`; tato migrace je
-- inkrementální krok 0017.
--
-- Přidává:
--   1) Draft sloupce na content_blocks / hero_config / services
--      (workflow koncept → publikovat; veřejné API vrací jen živý obsah).
--   2) Seed homepage textových sekcí a sdíleného NAP/footer configu
--      (výchozí hodnoty = aktuální hardcoded obsah, aby web vypadal stejně).
--
-- Run (local):  wrangler d1 execute DB --local  --file=db/migrations/0017_cms_drafts.sql
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0017_cms_drafts.sql

-- ── 1) DRAFT SLOUPCE ────────────────────────────────────────
-- content_blocks: rozpracovaná verze textu/JSON vedle živé
ALTER TABLE content_blocks ADD COLUMN draft_title TEXT;
ALTER TABLE content_blocks ADD COLUMN draft_content_markdown TEXT;
ALTER TABLE content_blocks ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_blocks ADD COLUMN draft_updated_at TIMESTAMP;
ALTER TABLE content_blocks ADD COLUMN draft_updated_by TEXT;

-- hero_config: rozpracovaná verze jako JSON
ALTER TABLE hero_config ADD COLUMN draft_json TEXT;
ALTER TABLE hero_config ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0;

-- services: rozpracovaná verze jako JSON (využije F2)
ALTER TABLE services ADD COLUMN draft_json TEXT;
ALTER TABLE services ADD COLUMN has_draft INTEGER NOT NULL DEFAULT 0;

-- ── 2) SEED: homepage textové sekce (type 'text') ───────────
-- Výchozí obsah převzat z aktuálního public/index.html.
INSERT OR IGNORE INTO content_blocks (id, section_key, title, content_markdown, content_type) VALUES
  (lower(hex(randomblob(8))), 'home-hero-tagline', 'Hero – štítek',
   'Komplementární péče &amp; Biorezonance', 'text'),
  (lower(hex(randomblob(8))), 'home-hero-desc', 'Hero – popis',
   'Biorezonanční metoda Bicom Optima v Písku. Citlivě, neinvazivně a s respektem k vašemu jedinečnému příběhu. Hledáme skutečné zátěže organismu a podporujeme přirozenou rovnováhu.', 'text'),
  (lower(hex(randomblob(8))), 'home-hero-cta-primary', 'Hero – tlačítko primární',
   'Objednat se online', 'text'),
  (lower(hex(randomblob(8))), 'home-hero-cta-secondary', 'Hero – tlačítko sekundární',
   'Zjistit, co mě trápí', 'text'),
  (lower(hex(randomblob(8))), 'home-pruvodce-title', 'Průvodce – nadpis',
   'Moje cesta k rovnováze', 'text'),
  (lower(hex(randomblob(8))), 'home-pruvodce-intro', 'Průvodce – úvod',
   '<p>Zvolte prosím potíže, které vás trápí. Náš interaktivní průvodce vám okamžitě zobrazí doporučený biorezonanční program, orientační počet sezení a postup.</p>', 'text'),
  (lower(hex(randomblob(8))), 'home-jakfunguje-title', 'Jak funguje – nadpis',
   'Jak funguje biorezonance', 'text'),
  (lower(hex(randomblob(8))), 'home-jakfunguje-intro', 'Jak funguje – text',
   '<p>Každá buňka, tkáň i orgán v těle má své jedinečné elektromagnetické vlnění. Pokud je organismus zatížen (stres, patogeny, alergeny, toxiny), tato přirozená komunikace mezi buňkami je narušena.</p><p>Přístroj Bicom Optima dokáže tyto elektromagnetické signály snímat prostřednictvím elektrod, upravovat je a vysílat zpět do těla. Cílem je podpořit autoregulační schopnosti těla a pomoci mu obnovit přirozenou vnitřní rovnováhu.</p><p>Jedná se o moderní biofyzikální metodu. Neinvazivně, bezbolestně a bez podávání chemických přípravků mapuje zátěže a stimuluje regeneraci.</p>', 'text'),
  (lower(hex(randomblob(8))), 'home-dukaz-title', 'Důvěra a bezpečí – nadpis',
   'Důvěra a Bezpečí', 'text'),
  (lower(hex(randomblob(8))), 'home-dukaz-intro', 'Důvěra a bezpečí – úvod',
   '<p>Provozujeme certifikovanou poradnu. Naším cílem je poskytovat služby na nejvyšší úrovni s maximálním respektem k vašemu bezpečí a soukromí.</p>', 'text'),
  (lower(hex(randomblob(8))), 'home-galerie-title', 'Galerie – nadpis',
   'Naše ordinace', 'text'),
  (lower(hex(randomblob(8))), 'home-magazin-title', 'Magazín – nadpis',
   'Magazín &amp; Rady pro zdraví', 'text'),
  (lower(hex(randomblob(8))), 'home-magazin-intro', 'Magazín – úvod',
   '<p>Přečtěte si nejnovější příspěvky, tipy pro posílení imunity a příběhy z naší biorezonanční praxe.</p>', 'text'),
  (lower(hex(randomblob(8))), 'home-rezervace-title', 'Rezervace – nadpis',
   'Objednejte se na biorezonanci', 'text'),
  (lower(hex(randomblob(8))), 'home-rezervace-intro', 'Rezervace – úvod',
   '<p>Vyberte si požadovanou službu a preferované datum. Po odeslání formuláře vás budeme kontaktovat pro potvrzení přesného času vašeho termínu.</p>', 'text'),
  (lower(hex(randomblob(8))), 'home-kontakt-title', 'Kontakt – nadpis',
   'Kde nás najdete', 'text');

-- ── 3) SEED: sdílený NAP / footer / kontakt (type 'config', JSON) ──
INSERT OR IGNORE INTO content_blocks (id, section_key, title, content_markdown, content_type) VALUES
  (lower(hex(randomblob(8))), 'site-nap', 'Kontaktní údaje a patička (NAP)',
   '{"company":"Bicom Písek","legal":"BIO ONE LIFE s.r.o.","ico":"23950978","street":"Vladislavova 201 (technologický park)","city":"Písek","zip":"397 01","phone":"+420 735 231 025","phoneHref":"+420735231025","email":"info@bicom-pisek.cz","hoursWeek":"Pondělí – Pátek: 8:00 – 18:00 (dle objednávek)","hoursWeekend":"Víkendy: Zavřeno","areas":"Písek (ordinace) · Strakonice (20 min) · Milevsko (25 min) · Vodňany (20 min) · Protivín (12 min) · Blatná (25 min).","brandDesc":"Šetrná podpora rovnováhy vašeho organismu pomocí certifikované biorezonanční metody Bicom Optima.","disclaimer":"Biorezonanční metoda Bicom Optima je doplňková (komplementární) metoda. Nenahrazuje standardní lékařskou péči, diagnostiku ani klinickou léčbu. Veškeré informace a poradenské programy jsou navrženy pro podporu přirozené autoregulace těla. Při zdravotních potížích se vždy poraďte se svým lékařem.","copyright":"© 2026 Bicom Písek. Všechna práva vyhrazena."}',
   'config');

-- ============================================================
-- Done — migrace 0017
-- ============================================================
