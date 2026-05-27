-- Migration 0006: Schema fixes (add missing columns to operators and bookings tables)
-- Fixes mismatches between application queries and database schema.

-- Add columns to operators table
ALTER TABLE operators ADD COLUMN active INTEGER DEFAULT 1 CHECK(active IN (0, 1));
ALTER TABLE operators ADD COLUMN calendar_id TEXT;

-- Add columns to bookings table
ALTER TABLE bookings ADD COLUMN calendar_event_id TEXT;
ALTER TABLE bookings ADD COLUMN operator_id TEXT REFERENCES operators(id);
ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMP;
