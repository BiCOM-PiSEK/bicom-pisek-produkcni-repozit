-- Migration 0014: Admin správa rezervací (ADR-005)
-- Datový základ: assigned_to (operátor), notification timestamps

ALTER TABLE bookings ADD COLUMN assigned_to TEXT;
ALTER TABLE bookings ADD COLUMN confirmation_sent_at TEXT;
ALTER TABLE bookings ADD COLUMN cancellation_notified_at TEXT;
