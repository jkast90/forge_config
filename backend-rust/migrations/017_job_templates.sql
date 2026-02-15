CREATE TABLE IF NOT EXISTS job_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    job_type TEXT NOT NULL DEFAULT 'command',
    command TEXT DEFAULT '',
    action_id TEXT DEFAULT '',
    target_mode TEXT NOT NULL DEFAULT 'device',
    target_device_ids TEXT DEFAULT '',
    target_group_id TEXT DEFAULT '',
    schedule TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
