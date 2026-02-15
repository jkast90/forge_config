-- Allow jobs without a device (e.g., static webhook actions)
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.

PRAGMA foreign_keys = OFF;

CREATE TABLE jobs_new (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    device_id TEXT NOT NULL DEFAULT '',
    command TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

INSERT INTO jobs_new (id, job_type, device_id, command, status, output, error, created_at, started_at, completed_at)
SELECT id, job_type, device_id, command, status, output, error, created_at, started_at, completed_at
FROM jobs;

DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

PRAGMA foreign_keys = ON;
