-- Bicom Písek — PostgreSQL Schema (Netlify Phase 1A)
-- Původně SQLite (Cloudflare D1), konvertováno na PostgreSQL.
-- Migrace: 0000_initial_schema.sql

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
    email_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_email_hash ON bookings(email_hash);
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
    icon_url TEXT,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    draft_json TEXT,
    has_draft INTEGER NOT NULL DEFAULT 0
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
    latitude REAL,
    longitude REAL,
    h3_hexagon_id TEXT,
    country_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geo_city ON geo_leads(city);
CREATE INDEX IF NOT EXISTS idx_geo_leads_h3 ON geo_leads(h3_hexagon_id);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('sms','email','whatsapp')),
    send_at TIMESTAMP NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- Foreign key to bookings omitted or added below
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
    UNIQUE(start_ts, operator_id)
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    content_type TEXT DEFAULT 'text' CHECK(content_type IN ('text','prompt','config','faq')),
    last_updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    draft_title TEXT,
    draft_content_markdown TEXT,
    has_draft INTEGER NOT NULL DEFAULT 0,
    draft_updated_at TIMESTAMP,
    draft_updated_by TEXT
);

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

CREATE TABLE IF NOT EXISTS process_states (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_assets_kind_status ON media_assets(kind, status);
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);

CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    payload_json TEXT,
    result_json TEXT,
    error_message TEXT,
    provider TEXT,
    model TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON ai_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS gallery_drafts (
    gallery_key TEXT PRIMARY KEY,
    draft_json TEXT NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gallery_key ON gallery_items(gallery_key);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_items(gallery_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_image_url ON gallery_items(image_url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_unique ON gallery_items(gallery_key, image_url);

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
    draft_json TEXT,
    has_draft INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- BOOKING SYSTEM: Availability & Settings
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
-- PHASE 2: Bug Registry & Monitoring
-- ============================================================

CREATE TABLE IF NOT EXISTS bug_registry (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'wontfix')),
    description TEXT,
    first_reported_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    occurrences INTEGER DEFAULT 1,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bug_registry_severity ON bug_registry(severity);
CREATE INDEX IF NOT EXISTS idx_bug_registry_status ON bug_registry(status);
CREATE INDEX IF NOT EXISTS idx_bug_registry_created ON bug_registry(created_at);

CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    alert_triggered_at TIMESTAMP,
    notified_at TIMESTAMP,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_endpoint ON monitoring_alerts(endpoint);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created ON monitoring_alerts(created_at);

CREATE TABLE IF NOT EXISTS slo_violations (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    metric TEXT,
    threshold_ms INTEGER,
    actual_ms INTEGER,
    violation_at TIMESTAMP,
    severity TEXT DEFAULT 'HIGH' CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_slo_violations_endpoint ON slo_violations(endpoint);
CREATE INDEX IF NOT EXISTS idx_slo_violations_metric ON slo_violations(metric);
CREATE INDEX IF NOT EXISTS idx_slo_violations_created ON slo_violations(created_at);

CREATE TABLE IF NOT EXISTS synthetic_test_results (
    id TEXT PRIMARY KEY,
    test_name TEXT NOT NULL,
    endpoint TEXT,
    passed BOOLEAN,
    response_time_ms INTEGER,
    error_message TEXT,
    test_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_name ON synthetic_test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_passed ON synthetic_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_created ON synthetic_test_results(created_at);

-- ============================================================
-- ADD FOREIGN KEYS
-- (Added at the end to prevent ordering issues during creation)
-- ============================================================

ALTER TABLE bookings ADD CONSTRAINT fk_bookings_operator FOREIGN KEY (operator_id) REFERENCES operators(id);
ALTER TABLE reminders ADD CONSTRAINT fk_reminders_booking FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE calendar_slots ADD CONSTRAINT fk_slots_operator FOREIGN KEY (operator_id) REFERENCES operators(id);
ALTER TABLE calendar_slots ADD CONSTRAINT fk_slots_booking FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE social_posts ADD CONSTRAINT fk_social_operator FOREIGN KEY (created_by) REFERENCES operators(id);
ALTER TABLE payment_transactions ADD CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE media_assets ADD CONSTRAINT fk_media_operator FOREIGN KEY (created_by) REFERENCES operators(id);
ALTER TABLE ai_jobs ADD CONSTRAINT fk_aijobs_operator FOREIGN KEY (created_by) REFERENCES operators(id);
ALTER TABLE gallery_drafts ADD CONSTRAINT fk_gallerydrafts_operator FOREIGN KEY (updated_by) REFERENCES operators(id);
ALTER TABLE gallery_items ADD CONSTRAINT fk_galleryitems_operator FOREIGN KEY (updated_by) REFERENCES operators(id);
ALTER TABLE hero_config ADD CONSTRAINT fk_hero_operator FOREIGN KEY (updated_by) REFERENCES operators(id);

-- ============================================================
-- Default booking settings
-- ============================================================

INSERT INTO booking_settings (id, slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days, require_confirmation, require_deposit, deposit_amount)
VALUES (1, 60, 10, 24, 60, 1, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- Default availability rules (Monday-Friday 9:00-17:00)
INSERT INTO availability_rules (id, weekday, start_time, end_time, active)
VALUES
    ('defrule001', 1, '09:00', '17:00', 1),
    ('defrule002', 2, '09:00', '17:00', 1),
    ('defrule003', 3, '09:00', '17:00', 1),
    ('defrule004', 4, '09:00', '17:00', 1),
    ('defrule005', 5, '09:00', '17:00', 1)
ON CONFLICT (id) DO NOTHING;

-- Default process states
INSERT INTO process_states (key, value, description) VALUES
    ('instagram_sync_status', 'active', 'Automatická synchronizace Instagram příspěvků'),
    ('gdpr_anonymizer_status', 'active', 'Anonymizér rezervací po 30 dnech'),
    ('invoice_mode', 'manual', 'Režim fakturace: auto_on_confirm | auto_after_visit | manual'),
    ('telegram_notifications', 'active', 'Odesílání notifikací do Telegram skupiny'),
    ('ai_copywriter_model', 'workers-ai', 'Primární AI model: workers-ai | groq | gemini'),
    ('ai_studio_prompts_enabled', '1', 'AI Studio prompt orchestrace: 1=enabled,0=disabled'),
    ('ai_studio_prompt_profile', 'default', 'Aktivní profil systémových promptů pro AI skills'),
    ('ai_studio_chat_max_sentences', '4', 'Max. počet vět v odpovědi AI chatu'),
    ('ai_studio_daily_image_cap', '50', 'Denní limit generování AI obrázků'),
    ('cashflow_alerts', 'active', 'Týdenní cash flow upozornění přes Telegram'),
    ('booking_sms_reminder', 'active', 'SMS upomínka T-24h před termínem')
ON CONFLICT (key) DO NOTHING;
