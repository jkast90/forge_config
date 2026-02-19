-- Add triggered_by column to jobs to distinguish scheduled vs manual runs
ALTER TABLE jobs ADD COLUMN triggered_by TEXT NOT NULL DEFAULT 'manual';
