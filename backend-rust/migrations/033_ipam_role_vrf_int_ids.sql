-- Migration 033: Convert IPAM Role and VRF IDs from TEXT to INTEGER
-- Order: Roles first (depended on by prefix_roles, ip_address_roles), then VRFs (depended on by prefixes, ip_addresses)

PRAGMA foreign_keys = OFF;

-- ========== IPAM Roles ==========

CREATE TABLE ipam_roles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ipam_roles_new (name, description, created_at)
SELECT name, description, created_at FROM ipam_roles ORDER BY name;

-- Build mapping table
CREATE TEMPORARY TABLE _role_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_roles old
JOIN ipam_roles_new new ON old.name = new.name;

-- Update ipam_prefix_roles
CREATE TABLE ipam_prefix_roles_new (
    prefix_id INTEGER NOT NULL REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES ipam_roles_new(id) ON DELETE CASCADE,
    PRIMARY KEY (prefix_id, role_id)
);

INSERT OR IGNORE INTO ipam_prefix_roles_new (prefix_id, role_id)
SELECT pr.prefix_id, m.new_id
FROM ipam_prefix_roles pr
JOIN _role_map m ON pr.role_id = m.old_id;

DROP TABLE ipam_prefix_roles;
ALTER TABLE ipam_prefix_roles_new RENAME TO ipam_prefix_roles;

-- Update ipam_ip_address_roles
CREATE TABLE ipam_ip_address_roles_new (
    ip_address_id TEXT NOT NULL REFERENCES ipam_ip_addresses(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES ipam_roles_new(id) ON DELETE CASCADE,
    PRIMARY KEY (ip_address_id, role_id)
);

INSERT OR IGNORE INTO ipam_ip_address_roles_new (ip_address_id, role_id)
SELECT iar.ip_address_id, m.new_id
FROM ipam_ip_address_roles iar
JOIN _role_map m ON iar.role_id = m.old_id;

DROP TABLE ipam_ip_address_roles;
ALTER TABLE ipam_ip_address_roles_new RENAME TO ipam_ip_address_roles;

DROP TABLE ipam_roles;
ALTER TABLE ipam_roles_new RENAME TO ipam_roles;

DROP TABLE _role_map;

-- ========== IPAM VRFs ==========

CREATE TABLE ipam_vrfs_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    rd TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO ipam_vrfs_new (name, rd, description, created_at, updated_at)
SELECT name, rd, description, created_at, updated_at FROM ipam_vrfs ORDER BY name;

-- Build mapping table
CREATE TEMPORARY TABLE _vrf_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_vrfs old
JOIN ipam_vrfs_new new ON old.name = new.name;

-- Update ipam_prefixes.vrf_id (nullable TEXT -> nullable INTEGER)
UPDATE ipam_prefixes SET vrf_id = (
    SELECT CAST(m.new_id AS TEXT) FROM _vrf_map m WHERE m.old_id = ipam_prefixes.vrf_id
) WHERE vrf_id IS NOT NULL AND vrf_id != '';

-- Update ipam_ip_addresses.vrf_id (nullable TEXT -> nullable INTEGER)
UPDATE ipam_ip_addresses SET vrf_id = (
    SELECT CAST(m.new_id AS TEXT) FROM _vrf_map m WHERE m.old_id = ipam_ip_addresses.vrf_id
) WHERE vrf_id IS NOT NULL AND vrf_id != '';

DROP TABLE ipam_vrfs;
ALTER TABLE ipam_vrfs_new RENAME TO ipam_vrfs;

DROP TABLE _vrf_map;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ipam_roles_name ON ipam_roles(name);
CREATE INDEX IF NOT EXISTS idx_ipam_vrfs_name ON ipam_vrfs(name);

PRAGMA foreign_keys = ON;
