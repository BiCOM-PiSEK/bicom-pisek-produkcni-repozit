-- ============================================================
-- Migration 0029: CMS Galerie — draft/publish workflow (F13)
-- ============================================================
-- Galerie už není "okamžitě živá": změny se ukládají jako koncept
-- do gallery_drafts a publikují se explicitně přes /admin/gallery
-- action:publish.
--
-- Run (local):  wrangler d1 execute DB --local  --file=db/migrations/0029_gallery_drafts.sql
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0029_gallery_drafts.sql

CREATE TABLE IF NOT EXISTS gallery_drafts (
    gallery_key TEXT PRIMARY KEY,
    draft_json TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_image_url ON gallery_items(image_url);

-- ============================================================
-- Done — migrace 0029
-- ============================================================
