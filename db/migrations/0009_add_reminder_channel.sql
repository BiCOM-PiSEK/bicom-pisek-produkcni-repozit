-- db/migrations/0009_add_reminder_channel.sql
-- Adds reminder_channel to bookings and expands CHECK constraint on reminders.channel to allow 'whatsapp'.

-- 1. Add reminder_channel column to bookings table
ALTER TABLE bookings ADD COLUMN reminder_channel TEXT DEFAULT 'email' CHECK(reminder_channel IN ('email','sms','whatsapp'));

-- 2. Rename existing reminders table to rebuild it safely
ALTER TABLE reminders RENAME TO reminders_old;

-- 3. Create new reminders table with updated CHECK constraint
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('sms','email','whatsapp')),
    send_at TIMESTAMP NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

-- 4. Copy data from old table to new table
INSERT INTO reminders (id, booking_id, channel, send_at, sent, created_at)
SELECT id, booking_id, channel, send_at, sent, created_at
FROM reminders_old;

-- 5. Drop old table
DROP TABLE reminders_old;

-- 6. Recreate indexes on reminders
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(send_at, sent);
