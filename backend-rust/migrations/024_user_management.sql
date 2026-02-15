-- Add enabled column to users table for account management
ALTER TABLE users ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
