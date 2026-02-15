-- Location hierarchy: Region → Campus → Datacenter → Hall → Row → Rack → Device
-- Campus = existing ipam_locations (renamed in code only, table stays same)
-- Hall, Row, Rack are new tables

-- Halls: within datacenters
CREATE TABLE IF NOT EXISTS ipam_halls (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    datacenter_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ipam_halls_dc ON ipam_halls(datacenter_id);

-- Rows: within halls
CREATE TABLE IF NOT EXISTS ipam_rows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    hall_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hall_id) REFERENCES ipam_halls(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ipam_rows_hall ON ipam_rows(hall_id);

-- Racks: within rows
CREATE TABLE IF NOT EXISTS ipam_racks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    row_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (row_id) REFERENCES ipam_rows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ipam_racks_row ON ipam_racks(row_id);

-- Location hierarchy on topologies
ALTER TABLE topologies ADD COLUMN region_id TEXT DEFAULT '';
ALTER TABLE topologies ADD COLUMN campus_id TEXT DEFAULT '';
ALTER TABLE topologies ADD COLUMN datacenter_id TEXT DEFAULT '';

-- Location hierarchy on devices
ALTER TABLE devices ADD COLUMN hall_id TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN row_id TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN rack_id TEXT DEFAULT '';
ALTER TABLE devices ADD COLUMN rack_position INTEGER DEFAULT 0;
