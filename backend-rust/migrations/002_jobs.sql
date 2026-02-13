-- Jobs table for async command execution and config deployment

CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    device_mac TEXT NOT NULL,
    command TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (device_mac) REFERENCES devices(mac) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device_mac);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
