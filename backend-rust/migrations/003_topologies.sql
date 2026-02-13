-- CLOS Topology support

CREATE TABLE IF NOT EXISTS topologies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add topology fields to devices
ALTER TABLE devices ADD COLUMN topology_id TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN topology_role TEXT DEFAULT '';

-- Index for fast lookups of devices by topology
CREATE INDEX IF NOT EXISTS idx_devices_topology ON devices(topology_id);
