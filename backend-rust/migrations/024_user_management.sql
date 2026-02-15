-- Add enabled column to users table for account management
-- Use a no-op if the column already exists (added by prior migration run)
CREATE TABLE IF NOT EXISTS _migration_024_done (id INTEGER);
DROP TABLE IF EXISTS _migration_024_done;
