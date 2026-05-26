-- Migration 0001: Core tables (bookings, newsletter, blog, services)
-- These are the foundation of the public-facing portal.

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    name_enc TEXT NOT NULL,
    email_enc TEXT NOT NULL,
    phone_enc TEXT NOT NULL,
    service TEXT NOT NULL,
    note_enc TEXT,
    preferred_date TEXT NOT NULL,
    psc TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','done','cancelled')),
    estimated_price INTEGER,
    consent_version TEXT,
    consent_marketing INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    anonymized_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id TEXT PRIMARY KEY,
    email_enc TEXT NOT NULL,
    email_hash TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active','unsubscribed')),
    source TEXT DEFAULT 'booking' CHECK(source IN ('booking','form','manual','ai_referral')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    jsonld TEXT,
    source TEXT DEFAULT 'instagram' CHECK(source IN ('instagram','ai_copywriter','manual')),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published')),
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status);

CREATE TABLE IF NOT EXISTS services (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT CHECK(category IN ('imunita','energie','bolest','psychika','hormony','metabolismus','organy','patogeny','prostredi','onkologie','prevence')),
    segment TEXT DEFAULT 'vsichni' CHECK(segment IN ('zeny','deti','profesionalove','biohackeri','vsichni')),
    short_desc TEXT,
    long_desc TEXT,
    price_avg INTEGER,
    price_note TEXT,
    sessions_typ TEXT,
    jsonld TEXT,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
