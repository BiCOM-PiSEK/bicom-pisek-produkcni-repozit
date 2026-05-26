-- Migration 0002: Analytics tables (geo_leads, reminders)

CREATE TABLE IF NOT EXISTS geo_leads (
    id TEXT PRIMARY KEY,
    psc TEXT,
    city TEXT,
    service TEXT,
    source TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geo_city ON geo_leads(city);

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    channel TEXT NOT NULL CHECK(channel IN ('sms','email')),
    send_at TIMESTAMP NOT NULL,
    sent INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(send_at, sent);
