-- db/migrations/0008_expand_content_type_check.sql
-- Safely expands the CHECK constraint on content_blocks.content_type to allow 'faq'.

-- 1. Rename existing table
ALTER TABLE content_blocks RENAME TO content_blocks_old;

-- 2. Create new table with updated CHECK constraint allowing 'faq'
CREATE TABLE content_blocks (
    id TEXT PRIMARY KEY,
    section_key TEXT UNIQUE NOT NULL,
    title TEXT,
    content_markdown TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','prompt','config','faq')),
    last_updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Copy data from old table to new table
INSERT INTO content_blocks (
    id, section_key, title, content_markdown, content_type, last_updated_by, updated_at
)
SELECT 
    id, section_key, title, content_markdown, content_type, last_updated_by, updated_at
FROM content_blocks_old;

-- 4. Drop old table
DROP TABLE content_blocks_old;
