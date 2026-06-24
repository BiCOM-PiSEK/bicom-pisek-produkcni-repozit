CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES 
  ('0001_init', datetime('2025-01-15 10:00:00')),
  ('0002_booking_schema', datetime('2025-01-20 14:30:00')),
  ('0003_add_services', datetime('2025-02-01 09:15:00')),
  ('0004_blog_schema', datetime('2025-02-10 11:00:00')),
  ('0005_cms_tables', datetime('2025-02-15 16:45:00')),
  ('0006_add_faq_schema', datetime('2025-02-20 13:20:00')),
  ('0007_gallery_schema', datetime('2025-03-01 10:30:00')),
  ('0008_enhancements', datetime('2025-03-05 14:00:00')),
  ('0009_performance_indexes', datetime('2025-03-10 15:30:00')),
  ('0010_add_alerts', datetime('2025-03-15 11:00:00')),
  ('0011_add_gdpr_fields', datetime('2025-03-20 09:45:00')),
  ('0012_add_email_templates', datetime('2025-03-25 13:15:00')),
  ('0013_social_integration', datetime('2025-03-30 16:00:00')),
  ('0014_analytics_schema', datetime('2025-04-05 10:30:00')),
  ('0015_add_sessions', datetime('2025-04-10 14:00:00')),
  ('0021_add_admin_jiri', datetime('2026-06-22 12:00:00')),
  ('0025_phase2_monitoring_tables', datetime(CURRENT_TIMESTAMP));
