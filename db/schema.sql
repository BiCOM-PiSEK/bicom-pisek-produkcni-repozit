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
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','done','cancelled','pending_payment')),
    estimated_price INTEGER,
    consent_version TEXT,
    consent_marketing INTEGER DEFAULT 0,
    reminder_channel TEXT DEFAULT 'email' CHECK(reminder_channel IN ('email','sms','whatsapp')),
    calendar_event_id TEXT,
    operator_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    anonymized_at TIMESTAMP,
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    stripe_payment_status TEXT,
    paid_amount INTEGER,
    paid_at TIMESTAMP,
    slot_start TEXT,
    slot_end TEXT,
    assigned_to TEXT,
    confirmation_sent_at TIMESTAMP,
    cancellation_notified_at TIMESTAMP,
    no_show_flag INTEGER DEFAULT 0,
    FOREIGN KEY (operator_id) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON bookings(stripe_session_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot_unique
  ON bookings(slot_start)
  WHERE slot_start IS NOT NULL
    AND status IN ('pending','confirmed','pending_payment');

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
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','scheduled','published','archived')),
    published_at TIMESTAMP,
    updated_at TIMESTAMP,
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
    channel TEXT NOT NULL CHECK(channel IN ('sms','email','whatsapp')),
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

-- DEPRECATED (2026-06-13, ADR-004 Cesta 2): Tabulka z migrace 0004, nikdy nenaplněná,
-- žádný kód do ní nepíše (jen _cron-backup ji zálohuje). Rezervační systém používá
-- Cestu 2 (sloty počítány za běhu z availability_rules + bookings.slot_start).
-- NEpoužívat, NEmazat.
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
CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    stripe_session_id TEXT NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CZK',
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
);

-- ============================================================
-- CONTENT MANAGEMENT & PROCESS STATES
-- ============================================================

CREATE TABLE IF NOT EXISTS content_blocks (
    id TEXT PRIMARY KEY,
    section_key TEXT UNIQUE NOT NULL,
    title TEXT,
    content_markdown TEXT NOT NULL,
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','prompt','config','faq')),
    last_updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS process_states (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CMS — galerie obrázků (F11, migrace 0016). Texty využívají content_blocks výše,
-- audit změn obsahu se zapisuje do existující tabulky audit_log.
CREATE TABLE IF NOT EXISTS gallery_items (
    id TEXT PRIMARY KEY,
    gallery_key TEXT NOT NULL,
    title TEXT,
    caption TEXT,
    image_url TEXT NOT NULL,
    image_filename TEXT,
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1 CHECK(active IN (0, 1)),
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_gallery_key ON gallery_items(gallery_key);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_items(gallery_key, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_unique ON gallery_items(gallery_key, image_url);

-- CMS — hero bannery jednotlivých stránek (F11, migrace 0016).
CREATE TABLE IF NOT EXISTS hero_config (
    id TEXT PRIMARY KEY,
    page_key TEXT UNIQUE NOT NULL,
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT,
    cta_link TEXT,
    background_image_url TEXT,
    overlay_color TEXT DEFAULT 'rgba(0,0,0,0.3)',
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);

-- ============================================================
-- BOOKING SYSTEM (ADR-004 F1): Availability & Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS availability_rules (
    id TEXT PRIMARY KEY,
    weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_availability_rules_weekday ON availability_rules(weekday);

CREATE TABLE IF NOT EXISTS availability_exceptions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    type TEXT NOT NULL CHECK(type IN ('holiday','vacation','adhoc','extra')),
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_availability_exceptions_date ON availability_exceptions(date);

CREATE TABLE IF NOT EXISTS booking_settings (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    slot_duration_min INTEGER DEFAULT 60,
    slot_gap_min INTEGER DEFAULT 10,
    min_lead_hours INTEGER DEFAULT 24,
    max_horizon_days INTEGER DEFAULT 60,
    require_confirmation INTEGER DEFAULT 1,
    require_deposit INTEGER DEFAULT 0,
    deposit_amount INTEGER,
    updated_at TIMESTAMP
);

-- ============================================================
-- Default booking settings
-- ============================================================

INSERT OR IGNORE INTO booking_settings (id, slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days, require_confirmation, require_deposit, deposit_amount)
VALUES (1, 60, 10, 24, 60, 1, 0, NULL);

-- Default availability rules (Monday-Friday 9:00-17:00)
INSERT OR IGNORE INTO availability_rules (id, weekday, start_time, end_time, active)
VALUES
    (lower(hex(randomblob(8))), 1, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 2, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 3, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 4, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 5, '09:00', '17:00', 1);

-- Default process states
INSERT OR IGNORE INTO process_states (key, value, description) VALUES
    ('instagram_sync_status', 'active', 'Automatická synchronizace Instagram příspěvků'),
    ('gdpr_anonymizer_status', 'active', 'Anonymizér rezervací po 30 dnech'),
    ('invoice_mode', 'manual', 'Režim fakturace: auto_on_confirm | auto_after_visit | manual'),
    ('telegram_notifications', 'active', 'Odesílání notifikací do Telegram skupiny'),
    ('ai_copywriter_model', 'workers-ai', 'Primární AI model: workers-ai | groq | gemini'),
    ('cashflow_alerts', 'active', 'Týdenní cash flow upozornění přes Telegram'),
    ('booking_sms_reminder', 'active', 'SMS upomínka T-24h před termínem');
