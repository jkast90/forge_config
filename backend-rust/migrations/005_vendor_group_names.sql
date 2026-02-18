-- Add group_names column to vendors table for vendor-based group auto-assignment
ALTER TABLE vendors ADD COLUMN group_names TEXT DEFAULT '[]';
