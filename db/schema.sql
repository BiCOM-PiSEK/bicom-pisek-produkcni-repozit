-- Bicom Písek — Complete D1 Schema (idempotent)
-- All tables for the ecosystem: bookings, services, content, management, analytics.
-- Sensitive fields (name, email, phone, note) are stored AES-GCM encrypted (Base64).
-- Run: npx wrangler d1 execute DB --local --file=db/schema.sql

-- ============================================================
-- CORE: Bookings, Newsletter, Blog, Services
-- ============================================================

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
    calendar_event_id TEXT,
    operator_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    anonymized_at TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES operators(id)
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

-- ============================================================
-- ANALYTICS: Geo Leads, Reminders
-- ============================================================

CREATE TABLE IF NOT EXISTS geo_leads (
    id TEXT PRIMARY KEY,
    psc TEXT,
    city TEXT,
    service TEXT,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geo_city ON geo_leads(city);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('sms','email')),
    send_at TIMESTAMP NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(send_at, sent);

-- ============================================================
-- AUDIT & OPERATORS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    entity_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('create','update','anonymize','export','delete','login','config')),
    actor TEXT,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK(role IN ('owner','admin')),
    calendar_color TEXT,
    email TEXT UNIQUE NOT NULL,
    telegram_user_id TEXT,
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    calendar_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CALENDAR & SOCIAL & CAMPAIGNS
-- ============================================================

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

-- ============================================================
-- CONTENT MANAGEMENT & PROCESS STATES
-- ============================================================

CREATE TABLE IF NOT EXISTS content_blocks (
    id TEXT PRIMARY KEY,
    section_key TEXT UNIQUE NOT NULL,
    title TEXT,
    content_markdown TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','prompt','config')),
    last_updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS process_states (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default process states
INSERT OR IGNORE INTO process_states (key, value, description) VALUES
    ('instagram_sync_status', 'active', 'Automatická synchronizace Instagram příspěvků'),
    ('gdpr_anonymizer_status', 'active', 'Anonymizér rezervací po 30 dnech'),
    ('invoice_mode', 'manual', 'Režim fakturace: auto_on_confirm | auto_after_visit | manual'),
    ('telegram_notifications', 'active', 'Odesílání notifikací do Telegram skupiny'),
    ('ai_copywriter_model', 'workers-ai', 'Primární AI model: workers-ai | groq | gemini'),
    ('cashflow_alerts', 'active', 'Týdenní cash flow upozornění přes Telegram'),
    ('booking_sms_reminder', 'active', 'SMS upomínka T-24h před termínem');
