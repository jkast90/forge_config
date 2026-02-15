-- Credential store for named SSH/API credentials
CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cred_type TEXT NOT NULL DEFAULT 'ssh',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add credential_id to job_templates so templates can reference specific credentials
ALTER TABLE job_templates ADD COLUMN credential_id TEXT DEFAULT '';

-- Add credential_id to jobs so running jobs know which credential to use
ALTER TABLE jobs ADD COLUMN credential_id TEXT DEFAULT '';
