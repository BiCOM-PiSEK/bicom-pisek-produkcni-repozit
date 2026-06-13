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

-- 4. Add slot columns to bookings (simple ALTER approach)
-- Note: Table is empty, ALTER ADD COLUMN is safe and preserves FK + indexes
ALTER TABLE bookings ADD COLUMN slot_start TEXT;
ALTER TABLE bookings ADD COLUMN slot_end TEXT;

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
