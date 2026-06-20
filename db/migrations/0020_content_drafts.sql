-- ============================================================
-- Migration 0020: Pojmenované koncepty (named drafts) — CMS F12-D
-- ============================================================
-- Zdroj pravdy = db/schema.sql; tato migrace je inkrementální krok 0020.
-- Aditivní: nová tabulka snapshotů konceptů. Pracovní (inline) koncept
-- na content_blocks/hero_config/services zůstává beze změny.
--
-- Run (local):  wrangler d1 execute DB --local  --file=db/migrations/0020_content_drafts.sql
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0020_content_drafts.sql

CREATE TABLE IF NOT EXISTS content_drafts (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL CHECK(entity IN ('content_blocks','hero_config','services')),
    entity_id TEXT NOT NULL,
    name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity, entity_id, name)
);
CREATE INDEX IF NOT EXISTS idx_content_drafts_entity ON content_drafts(entity, entity_id);

-- ============================================================
-- Done — migrace 0020
-- ============================================================
