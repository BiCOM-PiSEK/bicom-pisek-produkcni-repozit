-- Migration 0023: AI Studio job console table
-- Adds execution telemetry and retry tracking for visual generation jobs.

-- BEGIN;

CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
    payload_json TEXT,
    result_json TEXT,
    error_message TEXT,
    provider TEXT,
    model TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES operators(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON ai_jobs(status, created_at);

-- COMMIT;

