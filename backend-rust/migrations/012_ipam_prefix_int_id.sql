-- Migrate ipam_prefixes from TEXT id to INTEGER PRIMARY KEY AUTOINCREMENT
-- Also updates all foreign key references: ipam_prefix_roles, ipam_ip_addresses, ipam_tags

PRAGMA foreign_keys = OFF;

-- 1. Recreate ipam_prefixes with INTEGER id
CREATE TABLE ipam_prefixes_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL,
    network_int INTEGER NOT NULL,
    broadcast_int INTEGER NOT NULL,
    prefix_length INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    is_supernet INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER DEFAULT NULL,
    datacenter_id TEXT DEFAULT NULL,
    vlan_id INTEGER DEFAULT NULL,
    vrf_id TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES ipam_prefixes_new(id) ON DELETE SET NULL,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters(id) ON DELETE SET NULL,
    FOREIGN KEY (vrf_id) REFERENCES ipam_vrfs(id) ON DELETE SET NULL
);

-- Copy existing prefix data (old TEXT ids are discarded; new INTEGER ids are assigned)
-- We use a temp mapping table to translate old TEXT ids to new INTEGER ids
INSERT INTO ipam_prefixes_new (prefix, network_int, broadcast_int, prefix_length, description, status, is_supernet, datacenter_id, vlan_id, vrf_id, created_at, updated_at)
SELECT prefix, network_int, broadcast_int, prefix_length, description, status, is_supernet, datacenter_id, vlan_id, vrf_id, created_at, updated_at
FROM ipam_prefixes
ORDER BY network_int, prefix_length;

-- Build mapping from old TEXT id to new INTEGER id
CREATE TEMP TABLE prefix_id_map AS
SELECT old.id as old_id, new.id as new_id
FROM ipam_prefixes old
JOIN ipam_prefixes_new new ON old.network_int = new.network_int AND old.broadcast_int = new.broadcast_int AND COALESCE(old.vrf_id, '') = COALESCE(new.vrf_id, '');

-- Set parent_id references using the mapping
UPDATE ipam_prefixes_new SET parent_id = (
    SELECT m.new_id FROM prefix_id_map m
    JOIN ipam_prefixes old ON old.id = m.old_id
    WHERE old.id = (SELECT parent_id FROM ipam_prefixes WHERE network_int = ipam_prefixes_new.network_int AND broadcast_int = ipam_prefixes_new.broadcast_int AND COALESCE(ipam_prefixes.vrf_id, '') = COALESCE(ipam_prefixes_new.vrf_id, ''))
) WHERE EXISTS (
    SELECT 1 FROM ipam_prefixes WHERE network_int = ipam_prefixes_new.network_int AND broadcast_int = ipam_prefixes_new.broadcast_int AND parent_id IS NOT NULL AND COALESCE(ipam_prefixes.vrf_id, '') = COALESCE(ipam_prefixes_new.vrf_id, '')
);

-- 2. Recreate ipam_prefix_roles with INTEGER prefix_id
CREATE TABLE ipam_prefix_roles_new (
    prefix_id INTEGER NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (prefix_id, role_id),
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes_new(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE CASCADE
);

INSERT INTO ipam_prefix_roles_new (prefix_id, role_id)
SELECT m.new_id, pr.role_id
FROM ipam_prefix_roles pr
JOIN prefix_id_map m ON pr.prefix_id = m.old_id;

-- 3. Recreate ipam_ip_addresses with INTEGER prefix_id
CREATE TABLE ipam_ip_addresses_new (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    address_int INTEGER NOT NULL,
    prefix_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    role_id TEXT DEFAULT NULL,
    dns_name TEXT DEFAULT '',
    device_id TEXT DEFAULT NULL,
    interface_name TEXT DEFAULT '',
    vrf_id TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes_new(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL
);

INSERT INTO ipam_ip_addresses_new (id, address, address_int, prefix_id, description, status, role_id, dns_name, device_id, interface_name, vrf_id, created_at, updated_at)
SELECT ip.id, ip.address, ip.address_int, m.new_id, ip.description, ip.status, ip.role_id, ip.dns_name, ip.device_id, ip.interface_name, ip.vrf_id, ip.created_at, ip.updated_at
FROM ipam_ip_addresses ip
JOIN prefix_id_map m ON ip.prefix_id = m.old_id;

-- 4. Update ipam_tags: convert resource_id for prefix resources
UPDATE ipam_tags SET resource_id = (
    SELECT CAST(m.new_id AS TEXT) FROM prefix_id_map m WHERE m.old_id = ipam_tags.resource_id
) WHERE resource_type = 'prefix' AND resource_id IN (SELECT old_id FROM prefix_id_map);

-- 5. Preserve ip_address_roles data before dropping anything
CREATE TABLE IF NOT EXISTS ipam_ip_address_roles_backup AS
SELECT * FROM ipam_ip_address_roles;

-- Drop old tables and rename new ones
DROP TABLE IF EXISTS ipam_prefix_roles;
DROP TABLE IF EXISTS ipam_ip_address_roles;
DROP TABLE IF EXISTS ipam_ip_addresses;
DROP TABLE IF EXISTS ipam_prefixes;

ALTER TABLE ipam_prefixes_new RENAME TO ipam_prefixes;
ALTER TABLE ipam_prefix_roles_new RENAME TO ipam_prefix_roles;
ALTER TABLE ipam_ip_addresses_new RENAME TO ipam_ip_addresses;

-- Restore ip_address_roles
CREATE TABLE IF NOT EXISTS ipam_ip_address_roles (
    ip_address_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (ip_address_id, role_id),
    FOREIGN KEY (ip_address_id) REFERENCES ipam_ip_addresses(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE CASCADE
);

INSERT INTO ipam_ip_address_roles SELECT * FROM ipam_ip_address_roles_backup;
DROP TABLE ipam_ip_address_roles_backup;

-- 6. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_parent ON ipam_prefixes(parent_id);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_datacenter ON ipam_prefixes(datacenter_id);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_network ON ipam_prefixes(network_int, broadcast_int);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_status ON ipam_prefixes(status);

CREATE INDEX IF NOT EXISTS idx_ipam_ips_prefix ON ipam_ip_addresses(prefix_id);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_address ON ipam_ip_addresses(address_int);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_status ON ipam_ip_addresses(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipam_ips_unique_addr ON ipam_ip_addresses(address_int, prefix_id);

DROP TABLE prefix_id_map;

PRAGMA foreign_keys = ON;
