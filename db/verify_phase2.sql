-- Verify Phase 2 tables exist
SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%bug%' OR name LIKE '%slo%' OR name LIKE '%synthetic%' OR name LIKE '%monitoring%');
