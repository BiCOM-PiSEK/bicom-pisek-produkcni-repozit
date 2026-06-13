-- db/migrations/0012_booking_system.sql
-- ADR-004 F1: Reservation system with time slot selection
-- Creates availability rules, exceptions, booking settings, and adds slot times to bookings

-- 1. Create availability_rules table (regular opening hours)
CREATE TABLE IF NOT EXISTS availability_rules (
    id TEXT PRIMARY KEY,
    weekday INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_availability_rules_weekday ON availability_rules(weekday);

-- 2. Create availability_exceptions table (holidays, vacations, ad-hoc changes)
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

-- 3. Create booking_settings table (configuration)
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

-- 4. Add slot columns to bookings (using remake pattern)
-- Rename existing table
ALTER TABLE bookings RENAME TO bookings_old;

-- Recreate bookings with slot_start and slot_end columns
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,
    name_enc TEXT NOT NULL,
    email_enc TEXT NOT NULL,
    phone_enc TEXT NOT NULL,
    service TEXT NOT NULL,
    note_enc TEXT,
    preferred_date TEXT NOT NULL,
    slot_start TEXT,
    slot_end TEXT,
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
    FOREIGN KEY (operator_id) REFERENCES operators(id)
);

-- Copy data from old table
INSERT INTO bookings (id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, status, estimated_price, consent_version, consent_marketing, reminder_channel, calendar_event_id, operator_id, created_at, updated_at, anonymized_at, stripe_session_id, stripe_payment_intent_id, stripe_payment_status, paid_amount, paid_at)
SELECT id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc, status, estimated_price, consent_version, consent_marketing, reminder_channel, calendar_event_id, operator_id, created_at, updated_at, anonymized_at, stripe_session_id, stripe_payment_intent_id, stripe_payment_status, paid_amount, paid_at FROM bookings_old;

-- Drop old table
DROP TABLE bookings_old;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON bookings(stripe_session_id);

-- 5. Seed default availability rules (Monday-Friday 9:00-17:00)
INSERT OR IGNORE INTO availability_rules (id, weekday, start_time, end_time, active)
VALUES
    (lower(hex(randomblob(8))), 1, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 2, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 3, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 4, '09:00', '17:00', 1),
    (lower(hex(randomblob(8))), 5, '09:00', '17:00', 1);

-- 6. Seed booking_settings with defaults
INSERT OR IGNORE INTO booking_settings (id, slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days, require_confirmation, require_deposit, deposit_amount)
VALUES (1, 60, 10, 24, 60, 1, 0, NULL);
