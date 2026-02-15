-- Add patch panel metadata to port assignments
ALTER TABLE device_port_assignments ADD COLUMN patch_panel_a_id TEXT REFERENCES devices(id) ON DELETE SET NULL;
ALTER TABLE device_port_assignments ADD COLUMN patch_panel_a_port TEXT DEFAULT '';
ALTER TABLE device_port_assignments ADD COLUMN patch_panel_b_id TEXT REFERENCES devices(id) ON DELETE SET NULL;
ALTER TABLE device_port_assignments ADD COLUMN patch_panel_b_port TEXT DEFAULT '';
