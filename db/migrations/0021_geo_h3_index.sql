-- Migration 0021: GEO leads enrichment (edge coordinates + H3 index)

ALTER TABLE geo_leads ADD COLUMN latitude REAL;
ALTER TABLE geo_leads ADD COLUMN longitude REAL;
ALTER TABLE geo_leads ADD COLUMN h3_hexagon_id TEXT;
ALTER TABLE geo_leads ADD COLUMN country_code TEXT;

CREATE INDEX IF NOT EXISTS idx_geo_leads_h3 ON geo_leads(h3_hexagon_id);
