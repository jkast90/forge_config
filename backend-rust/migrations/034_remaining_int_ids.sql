-- Phase 5: Migrate IpamIpAddress, DeviceRole, and JobTemplate from TEXT to INTEGER PRIMARY KEY

PRAGMA foreign_keys = OFF;

-- ========== 1. IPAM IP Addresses ==========

CREATE TABLE ipam_ip_addresses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    address_int INTEGER NOT NULL,
    prefix_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    dns_name TEXT DEFAULT '',
    device_id INTEGER DEFAULT NULL,
    interface_name TEXT DEFAULT '',
    vrf_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
    FOREIGN KEY (vrf_id) REFERENCES ipam_vrfs(id) ON DELETE SET NULL
);

INSERT INTO ipam_ip_addresses_new (address, address_int, prefix_id, description, status,
    dns_name, device_id, interface_name, vrf_id, created_at, updated_at)
SELECT address, address_int, prefix_id, description, status,
       dns_name, device_id, interface_name,
       CASE WHEN vrf_id IS NOT NULL AND vrf_id != '' THEN CAST(vrf_id AS INTEGER) ELSE NULL END,
       created_at, updated_at
FROM ipam_ip_addresses
ORDER BY address_int;

-- Build mapping table (old TEXT id → new INTEGER id)
CREATE TABLE ip_address_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM ipam_ip_addresses old
JOIN ipam_ip_addresses_new new ON old.address = new.address
    AND old.prefix_id = new.prefix_id;

-- Update ipam_ip_address_roles junction table
CREATE TABLE ipam_ip_address_roles_new (
    ip_address_id INTEGER NOT NULL REFERENCES ipam_ip_addresses_new(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES ipam_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (ip_address_id, role_id)
);

INSERT OR IGNORE INTO ipam_ip_address_roles_new (ip_address_id, role_id)
SELECT m.new_id, iar.role_id
FROM ipam_ip_address_roles iar
JOIN ip_address_id_map m ON m.old_id = iar.ip_address_id;

-- Update ipam_tags referencing ip_addresses
UPDATE ipam_tags
SET resource_id = CAST((SELECT m.new_id FROM ip_address_id_map m WHERE m.old_id = ipam_tags.resource_id) AS TEXT)
WHERE resource_type = 'ip_address'
  AND resource_id IN (SELECT old_id FROM ip_address_id_map);

DROP TABLE ipam_ip_address_roles;
ALTER TABLE ipam_ip_address_roles_new RENAME TO ipam_ip_address_roles;

DROP TABLE ipam_ip_addresses;
ALTER TABLE ipam_ip_addresses_new RENAME TO ipam_ip_addresses;

DROP TABLE ip_address_id_map;

CREATE INDEX idx_ipam_ip_addresses_prefix ON ipam_ip_addresses(prefix_id);
CREATE INDEX idx_ipam_ip_addresses_device ON ipam_ip_addresses(device_id);
CREATE INDEX idx_ipam_ip_addresses_vrf ON ipam_ip_addresses(vrf_id);
CREATE INDEX idx_ipam_ip_addresses_address_int ON ipam_ip_addresses(address_int);

-- ========== 2. Device Roles ==========

CREATE TABLE device_roles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_names TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO device_roles_new (name, description, group_names, created_at, updated_at)
SELECT name, description, group_names, created_at, updated_at
FROM device_roles
ORDER BY name;

-- Build mapping table
CREATE TABLE device_role_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM device_roles old
JOIN device_roles_new new ON old.name = new.name;

-- Update device_role_templates junction table
-- template_id is already INTEGER (migrated in Phase 2)
CREATE TABLE device_role_templates_new (
    role_id INTEGER NOT NULL REFERENCES device_roles_new(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (role_id, template_id)
);

INSERT OR IGNORE INTO device_role_templates_new (role_id, template_id, sort_order)
SELECT m.new_id,
       CAST(drt.template_id AS INTEGER),
       drt.sort_order
FROM device_role_templates drt
JOIN device_role_id_map m ON m.old_id = drt.role_id;

DROP TABLE device_role_templates;
ALTER TABLE device_role_templates_new RENAME TO device_role_templates;

DROP TABLE device_roles;
ALTER TABLE device_roles_new RENAME TO device_roles;

DROP TABLE device_role_id_map;

-- ========== 3. Job Templates ==========

CREATE TABLE job_templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    job_type TEXT NOT NULL DEFAULT 'command',
    command TEXT DEFAULT '',
    action_id INTEGER DEFAULT 0,
    target_mode TEXT NOT NULL DEFAULT 'device',
    target_device_ids TEXT DEFAULT '',
    target_group_id INTEGER DEFAULT 0,
    schedule TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    credential_id INTEGER DEFAULT 0
);

INSERT INTO job_templates_new (name, description, job_type, command, action_id,
    target_mode, target_device_ids, target_group_id, schedule, enabled,
    last_run_at, created_at, updated_at, credential_id)
SELECT name, description, job_type, command,
       CASE WHEN action_id IS NOT NULL AND action_id != '' THEN CAST(action_id AS INTEGER) ELSE 0 END,
       target_mode, target_device_ids,
       CASE WHEN target_group_id IS NOT NULL AND target_group_id != '' THEN CAST(target_group_id AS INTEGER) ELSE 0 END,
       schedule, enabled, last_run_at, created_at, updated_at,
       CASE WHEN credential_id IS NOT NULL AND credential_id != '' THEN CAST(credential_id AS INTEGER) ELSE 0 END
FROM job_templates
ORDER BY name;

DROP TABLE job_templates;
ALTER TABLE job_templates_new RENAME TO job_templates;

PRAGMA foreign_keys = ON;
