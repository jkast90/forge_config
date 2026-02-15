-- Migrate IPAM location hierarchy from TEXT id to INTEGER PRIMARY KEY AUTOINCREMENT
-- Order: Regions -> Campuses (ipam_locations) -> Datacenters -> Halls -> Rows -> Racks
-- Also updates FK references in: topologies, devices, ipam_prefixes

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. ipam_regions
-- ============================================================
CREATE TABLE ipam_regions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ipam_regions_new (name, description, created_at, updated_at)
SELECT name, description, created_at, updated_at
FROM ipam_regions
ORDER BY name;

CREATE TEMP TABLE region_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_regions old
JOIN ipam_regions_new new ON old.name = new.name;

-- Update topologies.region_id
UPDATE topologies SET region_id = (
    SELECT CAST(m.new_id AS TEXT) FROM region_id_map m WHERE m.old_id = topologies.region_id
) WHERE region_id != '' AND region_id IS NOT NULL AND region_id IN (SELECT old_id FROM region_id_map);

-- Update ipam_tags resource_id for region resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM region_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'region' AND resource_id IN (SELECT old_id FROM region_id_map);

-- ============================================================
-- 2. ipam_locations (Campuses)
-- ============================================================
CREATE TABLE ipam_locations_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES ipam_regions_new(id) ON DELETE CASCADE
);

INSERT INTO ipam_locations_new (name, description, region_id, created_at, updated_at)
SELECT l.name, l.description,
       COALESCE((SELECT m.new_id FROM region_id_map m WHERE m.old_id = l.region_id), 0),
       l.created_at, l.updated_at
FROM ipam_locations l
ORDER BY l.name;

CREATE TEMP TABLE campus_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_locations old
JOIN ipam_locations_new new ON old.name = new.name;

-- Update topologies.campus_id
UPDATE topologies SET campus_id = (
    SELECT CAST(m.new_id AS TEXT) FROM campus_id_map m WHERE m.old_id = topologies.campus_id
) WHERE campus_id != '' AND campus_id IS NOT NULL AND campus_id IN (SELECT old_id FROM campus_id_map);

-- Update ipam_tags resource_id for campus resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM campus_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'campus' AND resource_id IN (SELECT old_id FROM campus_id_map);

-- ============================================================
-- 3. ipam_datacenters
-- ============================================================
CREATE TABLE ipam_datacenters_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    location_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES ipam_locations_new(id) ON DELETE CASCADE
);

INSERT INTO ipam_datacenters_new (name, description, location_id, created_at, updated_at)
SELECT d.name, d.description,
       COALESCE((SELECT m.new_id FROM campus_id_map m WHERE m.old_id = d.location_id), 0),
       d.created_at, d.updated_at
FROM ipam_datacenters d
ORDER BY d.name;

CREATE TEMP TABLE dc_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_datacenters old
JOIN ipam_datacenters_new new ON old.name = new.name;

-- Update topologies.datacenter_id
UPDATE topologies SET datacenter_id = (
    SELECT CAST(m.new_id AS TEXT) FROM dc_id_map m WHERE m.old_id = topologies.datacenter_id
) WHERE datacenter_id != '' AND datacenter_id IS NOT NULL AND datacenter_id IN (SELECT old_id FROM dc_id_map);

-- Update ipam_prefixes.datacenter_id
UPDATE ipam_prefixes SET datacenter_id = (
    SELECT CAST(m.new_id AS TEXT) FROM dc_id_map m WHERE m.old_id = ipam_prefixes.datacenter_id
) WHERE datacenter_id IS NOT NULL AND datacenter_id IN (SELECT old_id FROM dc_id_map);

-- Update ipam_tags resource_id for datacenter resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM dc_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'datacenter' AND resource_id IN (SELECT old_id FROM dc_id_map);

-- ============================================================
-- 4. ipam_halls
-- ============================================================
CREATE TABLE ipam_halls_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    datacenter_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters_new(id) ON DELETE CASCADE
);

INSERT INTO ipam_halls_new (name, description, datacenter_id, created_at, updated_at)
SELECT h.name, h.description,
       COALESCE((SELECT m.new_id FROM dc_id_map m WHERE m.old_id = h.datacenter_id), 0),
       h.created_at, h.updated_at
FROM ipam_halls h
ORDER BY h.name;

CREATE TEMP TABLE hall_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_halls old
JOIN ipam_halls_new new ON old.name = new.name;

-- Update devices.hall_id
UPDATE devices SET hall_id = (
    SELECT CAST(m.new_id AS TEXT) FROM hall_id_map m WHERE m.old_id = devices.hall_id
) WHERE hall_id != '' AND hall_id IS NOT NULL AND hall_id IN (SELECT old_id FROM hall_id_map);

-- Update ipam_tags resource_id for hall resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM hall_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'hall' AND resource_id IN (SELECT old_id FROM hall_id_map);

-- ============================================================
-- 5. ipam_rows
-- ============================================================
CREATE TABLE ipam_rows_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    hall_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hall_id) REFERENCES ipam_halls_new(id) ON DELETE CASCADE
);

INSERT INTO ipam_rows_new (name, description, hall_id, created_at, updated_at)
SELECT r.name, r.description,
       COALESCE((SELECT m.new_id FROM hall_id_map m WHERE m.old_id = r.hall_id), 0),
       r.created_at, r.updated_at
FROM ipam_rows r
ORDER BY r.name;

CREATE TEMP TABLE row_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_rows old
JOIN ipam_rows_new new ON old.name = new.name;

-- Update devices.row_id
UPDATE devices SET row_id = (
    SELECT CAST(m.new_id AS TEXT) FROM row_id_map m WHERE m.old_id = devices.row_id
) WHERE row_id != '' AND row_id IS NOT NULL AND row_id IN (SELECT old_id FROM row_id_map);

-- Update ipam_tags resource_id for row resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM row_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'row' AND resource_id IN (SELECT old_id FROM row_id_map);

-- ============================================================
-- 6. ipam_racks
-- ============================================================
CREATE TABLE ipam_racks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    row_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (row_id) REFERENCES ipam_rows_new(id) ON DELETE CASCADE
);

INSERT INTO ipam_racks_new (name, description, row_id, created_at, updated_at)
SELECT rk.name, rk.description,
       COALESCE((SELECT m.new_id FROM row_id_map m WHERE m.old_id = rk.row_id), 0),
       rk.created_at, rk.updated_at
FROM ipam_racks rk
ORDER BY rk.name;

CREATE TEMP TABLE rack_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_racks old
JOIN ipam_racks_new new ON old.name = new.name;

-- Update devices.rack_id
UPDATE devices SET rack_id = (
    SELECT CAST(m.new_id AS TEXT) FROM rack_id_map m WHERE m.old_id = devices.rack_id
) WHERE rack_id != '' AND rack_id IS NOT NULL AND rack_id IN (SELECT old_id FROM rack_id_map);

-- Update ipam_tags resource_id for rack resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM rack_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'rack' AND resource_id IN (SELECT old_id FROM rack_id_map);

-- ============================================================
-- 7. Drop old tables and rename new ones
-- ============================================================
DROP TABLE IF EXISTS ipam_racks;
DROP TABLE IF EXISTS ipam_rows;
DROP TABLE IF EXISTS ipam_halls;
DROP TABLE IF EXISTS ipam_datacenters;
DROP TABLE IF EXISTS ipam_locations;
DROP TABLE IF EXISTS ipam_regions;

ALTER TABLE ipam_regions_new RENAME TO ipam_regions;
ALTER TABLE ipam_locations_new RENAME TO ipam_locations;
ALTER TABLE ipam_datacenters_new RENAME TO ipam_datacenters;
ALTER TABLE ipam_halls_new RENAME TO ipam_halls;
ALTER TABLE ipam_rows_new RENAME TO ipam_rows;
ALTER TABLE ipam_racks_new RENAME TO ipam_racks;

-- ============================================================
-- 8. Recreate indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ipam_locations_region ON ipam_locations(region_id);
CREATE INDEX IF NOT EXISTS idx_ipam_datacenters_location ON ipam_datacenters(location_id);
CREATE INDEX IF NOT EXISTS idx_ipam_halls_dc ON ipam_halls(datacenter_id);
CREATE INDEX IF NOT EXISTS idx_ipam_rows_hall ON ipam_rows(hall_id);
CREATE INDEX IF NOT EXISTS idx_ipam_racks_row ON ipam_racks(row_id);

-- ============================================================
-- 9. Clean up temp tables
-- ============================================================
DROP TABLE IF EXISTS region_id_map;
DROP TABLE IF EXISTS campus_id_map;
DROP TABLE IF EXISTS dc_id_map;
DROP TABLE IF EXISTS hall_id_map;
DROP TABLE IF EXISTS row_id_map;
DROP TABLE IF EXISTS rack_id_map;

PRAGMA foreign_keys = ON;
