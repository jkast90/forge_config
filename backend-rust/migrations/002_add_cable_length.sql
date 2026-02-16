-- Add cable length estimation to port assignments
ALTER TABLE device_port_assignments ADD COLUMN cable_length_meters REAL DEFAULT NULL;
