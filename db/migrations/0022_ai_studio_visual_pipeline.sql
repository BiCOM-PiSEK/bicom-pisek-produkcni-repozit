-- Migration 0022: AI Studio visual pipeline (media_assets + runtime keys)
-- Adds storage/audit-ready lifecycle table for generated visual assets.

-- BEGIN;

CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('article_cover','social_post','social_story','social_carousel','web_banner')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','archived','failed')),
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    overlay_text TEXT,
    overlay_subline TEXT,
    provider TEXT,
    model TEXT,
    r2_key TEXT NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    overlay_svg_url TEXT,
    mime_type TEXT DEFAULT 'image/png',
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES operators(id)
);

CREATE INDEX IF NOT EXISTS idx_media_assets_kind_status ON media_assets(kind, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);

INSERT OR IGNORE INTO process_states (key, value, description) VALUES
    ('ai_studio_prompts_enabled', '1', 'AI Studio prompt orchestrace: 1=enabled,0=disabled'),
    ('ai_studio_prompt_profile', 'default', 'Aktivní profil systémových promptů pro AI skills'),
    ('ai_studio_chat_max_sentences', '4', 'Max. počet vět v odpovědi AI chatu'),
    ('ai_studio_daily_image_cap', '50', 'Denní limit generování AI obrázků');

-- COMMIT;

