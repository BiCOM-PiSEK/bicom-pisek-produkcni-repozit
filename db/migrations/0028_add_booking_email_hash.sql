-- Migration 0028: Add email_hash column to bookings table for deterministic lookups and GDPR-compliant searching
ALTER TABLE bookings ADD COLUMN email_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_email_hash ON bookings(email_hash);
