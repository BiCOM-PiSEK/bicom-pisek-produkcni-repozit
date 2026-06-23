-- Phase 2: Bug Registry & Monitoring Infrastructure
-- Tables: bug_registry, monitoring_alerts, slo_violations, synthetic_test_results

CREATE TABLE IF NOT EXISTS bug_registry (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved', 'wontfix')),
    description TEXT,
    first_reported_at TIMESTAMP,
    last_seen_at TIMESTAMP,
    occurrences INTEGER DEFAULT 1,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bug_registry_severity ON bug_registry(severity);
CREATE INDEX IF NOT EXISTS idx_bug_registry_status ON bug_registry(status);
CREATE INDEX IF NOT EXISTS idx_bug_registry_created ON bug_registry(created_at);

CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_message TEXT,
    alert_triggered_at TIMESTAMP,
    notified_at TIMESTAMP,
    severity TEXT CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_endpoint ON monitoring_alerts(endpoint);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created ON monitoring_alerts(created_at);

CREATE TABLE IF NOT EXISTS slo_violations (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    metric TEXT,
    threshold_ms INTEGER,
    actual_ms INTEGER,
    violation_at TIMESTAMP,
    severity TEXT DEFAULT 'HIGH' CHECK(severity IN ('CRITICAL', 'HIGH', 'MEDIUM')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_slo_violations_endpoint ON slo_violations(endpoint);
CREATE INDEX IF NOT EXISTS idx_slo_violations_metric ON slo_violations(metric);
CREATE INDEX IF NOT EXISTS idx_slo_violations_created ON slo_violations(created_at);

CREATE TABLE IF NOT EXISTS synthetic_test_results (
    id TEXT PRIMARY KEY,
    test_name TEXT NOT NULL,
    endpoint TEXT,
    passed BOOLEAN,
    response_time_ms INTEGER,
    error_message TEXT,
    test_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_name ON synthetic_test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_passed ON synthetic_test_results(passed);
CREATE INDEX IF NOT EXISTS idx_synthetic_tests_created ON synthetic_test_results(created_at);
