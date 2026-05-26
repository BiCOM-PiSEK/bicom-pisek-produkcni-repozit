-- Migration 0005: Content management and process states

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

-- Default process states (configurable by operators in admin SPA)
INSERT OR IGNORE INTO process_states (key, value, description) VALUES
    ('instagram_sync_status', 'active', 'Automatická synchronizace Instagram příspěvků'),
    ('gdpr_anonymizer_status', 'active', 'Anonymizér rezervací po 30 dnech'),
    ('invoice_mode', 'manual', 'Režim fakturace: auto_on_confirm | auto_after_visit | manual'),
    ('telegram_notifications', 'active', 'Odesílání notifikací do Telegram skupiny'),
    ('ai_copywriter_model', 'workers-ai', 'Primární AI model: workers-ai | groq | gemini'),
    ('cashflow_alerts', 'active', 'Týdenní cash flow upozornění přes Telegram'),
    ('booking_sms_reminder', 'active', 'SMS upomínka T-24h před termínem');
