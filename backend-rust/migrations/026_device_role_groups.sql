-- Add group_names column to device_roles for auto-group assignment
ALTER TABLE device_roles ADD COLUMN group_names TEXT NOT NULL DEFAULT '[]';
