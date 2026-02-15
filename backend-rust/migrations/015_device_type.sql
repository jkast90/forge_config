-- Add device_type column to distinguish internal (managed) vs external devices
ALTER TABLE devices ADD COLUMN device_type TEXT NOT NULL DEFAULT 'internal';
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
