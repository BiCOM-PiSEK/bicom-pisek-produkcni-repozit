-- db/migrations/0007_stripe_integration.sql
-- Safely modifies bookings table in SQLite to add 'pending_payment' to the status constraint
-- and adds Stripe columns.

-- 1. Rename existing table
ALTER TABLE bookings RENAME TO bookings_old;

-- 2. Create new table with updated CHECK constraint and new Stripe columns
CREATE TABLE bookings (
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

-- 3. Copy data from old table to new table
INSERT INTO bookings (
    id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc,
    status, estimated_price, consent_version, consent_marketing, calendar_event_id,
    operator_id, created_at, updated_at, anonymized_at
)
SELECT 
    id, name_enc, email_enc, phone_enc, service, note_enc, preferred_date, psc,
    status, estimated_price, consent_version, consent_marketing, calendar_event_id,
    operator_id, created_at, updated_at, anonymized_at
FROM bookings_old;

-- 4. Drop old table
DROP TABLE bookings_old;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session ON bookings(stripe_session_id);

-- 6. Create payment transactions table
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
