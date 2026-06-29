-- ============================================================
-- Migration 0027: Normalize canonical URLs to extensionless format
-- ============================================================
-- Strips .html extensions from canonical URLs in SEO config blocks
-- that were seeded by 0019. Safe to re-run (idempotent).
-- Run (remote): wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0027_normalize_canonical_urls.sql

UPDATE content_blocks
SET content_markdown = replace(content_markdown, '.html"', '"')
WHERE section_key LIKE 'seo-%';

UPDATE content_blocks
SET draft_content_markdown = replace(draft_content_markdown, '.html"', '"')
WHERE section_key LIKE 'seo-%' AND draft_content_markdown IS NOT NULL;
