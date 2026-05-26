-- Migration 0004: Calendar slots, social posts, marketing campaigns

CREATE TABLE IF NOT EXISTS calendar_slots (
    id TEXT PRIMARY KEY,
    start_ts TIMESTAMP NOT NULL,
    end_ts TIMESTAMP NOT NULL,
    operator_id TEXT,
    booking_id TEXT,
    status TEXT DEFAULT 'available' CHECK(status IN ('available','pending','confirmed','blocked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(start_ts, operator_id),
    FOREIGN KEY (operator_id) REFERENCES operators(id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS social_posts (
    id TEXT PRIMARY KEY,
    content_text TEXT,
    media_url TEXT,
    platform TEXT DEFAULT 'instagram' CHECK(platform IN ('instagram','facebook','telegram')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','failed')),
    publish_at TIMESTAMP,
    utm_source TEXT,
    utm_campaign TEXT,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES operators(id)
);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
    target_geo TEXT,
    target_segment TEXT,
    budget_czk INTEGER,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
