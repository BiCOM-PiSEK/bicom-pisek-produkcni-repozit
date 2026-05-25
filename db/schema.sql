-- Bicom Písek — D1 schéma (idempotentní). Detail: 01_ARCHITEKTURA/02_Databaze_D1_logika_a_zivost.md
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, name_enc TEXT NOT NULL, email_enc TEXT NOT NULL,
  phone_enc TEXT NOT NULL, service TEXT NOT NULL, note_enc TEXT,
  preferred_date TEXT NOT NULL, psc TEXT, status TEXT DEFAULT 'pending',
  consent_version TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, anonymized_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY, email_enc TEXT NOT NULL, email_hash TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, excerpt TEXT,
  content TEXT NOT NULL, image_url TEXT, jsonld TEXT, source TEXT DEFAULT 'instagram',
  status TEXT DEFAULT 'draft', published_at TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blog_status ON blog_posts(status, published_at);

CREATE TABLE IF NOT EXISTS services (
  slug TEXT PRIMARY KEY, name TEXT NOT NULL, segment TEXT, short_desc TEXT, long_desc TEXT,
  price_from INTEGER, sessions_typ TEXT, jsonld TEXT, active INTEGER DEFAULT 1,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS geo_leads (
  id TEXT PRIMARY KEY, psc TEXT, city TEXT, service TEXT, source TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_geo_city ON geo_leads(city, created_at);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, channel TEXT NOT NULL,
  send_at TIMESTAMP NOT NULL, sent INTEGER DEFAULT 0,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent, send_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY, entity TEXT NOT NULL, entity_id TEXT, action TEXT NOT NULL,
  actor TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
