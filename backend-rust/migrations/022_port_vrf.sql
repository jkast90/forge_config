-- Add VRF assignment to port assignments (interface-level VRF membership)
ALTER TABLE device_port_assignments ADD COLUMN vrf_id TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_port_assignments_vrf ON device_port_assignments(vrf_id);
