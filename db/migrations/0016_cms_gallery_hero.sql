-- ============================================================
-- Migration 0016: CMS — galerie obrázků + hero bannery (F11)
-- ============================================================
-- Zdroj pravdy pro strukturu DB je `db/schema.sql`; tato migrace je
-- inkrementální krok 0016 (změny oproti předchozímu stavu schématu).
-- Doplňuje editovatelnost obsahu webu bez deploymentu.
--
-- POZNÁMKA K ROZSAHU (oproti původní spec v docs/agent-tasks/):
--   - Textové sekce a audit trail NEvytváříme znovu — využíváme již
--     existující tabulky `content_blocks` (texty) a `audit_log` (audit).
--   - Nově přidáváme jen to, co v repu chybí: `gallery_items` a `hero_config`.
--   - Obrázky se servírují přes /api/media/* z R2 bindingu MEDIA
--     (žádná externí CDN/custom doména není potřeba).
--
-- Run (local):  wrangler d1 execute DB --local  --file=db/migrations/0016_cms_gallery_hero.sql
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0016_cms_gallery_hero.sql

-- ============================================================
-- GALLERY ITEMS — obrázky v galeriích (ordinace, služby, …)
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_items (
    id TEXT PRIMARY KEY,
    gallery_key TEXT NOT NULL,            -- 'ordinace', 'service-energia', …
    title TEXT,
    caption TEXT,                         -- popisek pod obrázkem (alt/podtitulek)
    image_url TEXT NOT NULL,              -- veřejná cesta (/api/media/... nebo /assets/...)
    image_filename TEXT,                  -- původní název souboru (tracking)
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_gallery_key ON gallery_items(gallery_key);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_items(gallery_key, sort_order);
-- Zamezí duplicitám stejného obrázku v jedné galerii a zajistí, že seed
-- níže je idempotentní i při opakovaném spuštění migrace (INSERT OR IGNORE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_unique ON gallery_items(gallery_key, image_url);

-- ============================================================
-- HERO CONFIG — hero banner pro jednotlivé stránky
-- ============================================================

CREATE TABLE IF NOT EXISTS hero_config (
    id TEXT PRIMARY KEY,
    page_key TEXT UNIQUE NOT NULL,        -- 'homepage', 'ordinace', …
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT,
    cta_link TEXT,
    background_image_url TEXT,            -- veřejná cesta (/api/media/... nebo /assets/...)
    overlay_color TEXT DEFAULT 'rgba(0,0,0,0.3)',
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);

-- ============================================================
-- SEED — galerie "ordinace" napojená na existující statické fotky
-- (zajišťuje, že web po zapnutí CMS vypadá identicky jako dnes)
-- ============================================================

INSERT OR IGNORE INTO gallery_items (id, gallery_key, image_url, image_filename, caption, sort_order) VALUES
    (lower(hex(randomblob(8))), 'ordinace', '/assets/img/gallery/ordinace-01.webp', 'ordinace-01.webp', 'Pohled do světlé a harmonicky sladěné ordinace', 1),
    (lower(hex(randomblob(8))), 'ordinace', '/assets/img/gallery/ordinace-04.webp', 'ordinace-04.webp', 'Vstupní prostor a recepce poradny', 2),
    (lower(hex(randomblob(8))), 'ordinace', '/assets/img/gallery/ordinace-02.webp', 'ordinace-02.webp', 'Detailní pohled na přístroj Bicom Optima a čisté terapeutické doplňky', 3),
    (lower(hex(randomblob(8))), 'ordinace', '/assets/img/gallery/ordinace-05.webp', 'ordinace-05.webp', 'Klidný bylinkový a čajový koutek pro vaše pohodlí', 4),
    (lower(hex(randomblob(8))), 'ordinace', '/assets/img/gallery/ordinace-03.webp', 'ordinace-03.webp', 'Detail křesla a harmonického prostředí pro klienta', 5);

-- ============================================================
-- SEED — textová sekce galerie (přes existující content_blocks)
-- ============================================================

INSERT OR IGNORE INTO content_blocks (id, section_key, title, content_markdown, content_type) VALUES
    (lower(hex(randomblob(8))), 'homepage-galerie-intro', 'Naše ordinace',
     '<p>Prohlédněte si prostředí naší písecké poradny. Zakládáme si na klidné, harmonické atmosféře bez klinického chladu, kde se budete cítit bezpečně a pohodlně.</p>',
     'text');

-- ============================================================
-- Done — migrace 0016
-- ============================================================
