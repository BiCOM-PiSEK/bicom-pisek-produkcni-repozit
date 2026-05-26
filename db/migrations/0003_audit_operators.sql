-- Migration 0003: Audit log and operators

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
