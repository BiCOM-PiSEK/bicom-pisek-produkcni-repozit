-- db/migrations/0011_blog_status_expand.sql
-- Safely expands the CHECK constraint on blog_posts.status to allow 'scheduled' and 'archived', and adds updated_at column.

-- 1. Rename existing table
ALTER TABLE blog_posts RENAME TO blog_posts_old;

-- 2. Create new table with updated CHECK constraint and updated_at column
CREATE TABLE blog_posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    jsonld TEXT,
    source TEXT DEFAULT 'instagram' CHECK(source IN ('instagram','ai_copywriter','manual')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','archived')),
    published_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Copy data from old table to new table
INSERT INTO blog_posts (
    id, slug, title, excerpt, content, image_url, jsonld, source, status, published_at, created_at
)
SELECT 
    id, slug, title, excerpt, content, image_url, jsonld, source, status, published_at, created_at
FROM blog_posts_old;

-- 4. Drop old table
DROP TABLE blog_posts_old;

-- 5. Re-create index
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);
