-- Migrate devices.id from TEXT to INTEGER PRIMARY KEY AUTOINCREMENT.
-- Also makes mac nullable (patch panels have no MAC) and ip defaults to ''.
-- Since the DB is reset on each backend rebuild (seeds repopulate), we can
-- safely rebuild all affected tables using a mapping table for the id change.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. Recreate devices with INTEGER id
-- ============================================================

CREATE TABLE devices_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac TEXT DEFAULT NULL,
    ip TEXT DEFAULT '',
    hostname TEXT NOT NULL,
    vendor TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    config_template TEXT DEFAULT '',
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    topology_id TEXT DEFAULT '',
    topology_role TEXT DEFAULT '',
    status TEXT DEFAULT 'offline',
    last_seen DATETIME,
    last_backup DATETIME,
    last_error TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_type TEXT NOT NULL DEFAULT 'internal',
    hall_id TEXT DEFAULT '',
    row_id TEXT DEFAULT '',
    rack_id TEXT DEFAULT '',
    rack_position INTEGER DEFAULT 0
);

INSERT INTO devices_new (mac, ip, hostname, vendor, model, serial_number, config_template,
    ssh_user, ssh_pass, topology_id, topology_role, status, last_seen, last_backup, last_error,
    created_at, updated_at, device_type, hall_id, row_id, rack_id, rack_position)
SELECT mac, ip, hostname, vendor, model, serial_number, config_template,
    ssh_user, ssh_pass, topology_id, topology_role, status, last_seen, last_backup, last_error,
    created_at, updated_at, device_type, hall_id, row_id, rack_id, rack_position
FROM devices
ORDER BY created_at, id;

-- Build mapping from old TEXT id to new INTEGER id
CREATE TEMP TABLE device_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM devices old
JOIN devices_new new ON COALESCE(old.mac, '') = COALESCE(new.mac, '')
    AND old.hostname = new.hostname
    AND old.created_at = new.created_at;

-- ============================================================
-- 2. Recreate backups with INTEGER device_id
-- ============================================================

CREATE TABLE backups_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices_new(id) ON DELETE CASCADE
);

INSERT INTO backups_new (id, device_id, filename, size, created_at)
SELECT b.id, m.new_id, b.filename, b.size, b.created_at
FROM backups b
JOIN device_id_map m ON b.device_id = m.old_id;

-- ============================================================
-- 3. Recreate device_variables with INTEGER device_id
-- ============================================================

CREATE TABLE device_variables_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices_new(id) ON DELETE CASCADE,
    UNIQUE(device_id, key)
);

INSERT INTO device_variables_new (id, device_id, key, value, created_at, updated_at)
SELECT dv.id, m.new_id, dv.key, dv.value, dv.created_at, dv.updated_at
FROM device_variables dv
JOIN device_id_map m ON dv.device_id = m.old_id;

-- ============================================================
-- 4. Recreate device_group_members with INTEGER device_id
-- ============================================================

CREATE TABLE device_group_members_new (
    device_id INTEGER NOT NULL,
    group_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, group_id),
    FOREIGN KEY (device_id) REFERENCES devices_new(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

INSERT INTO device_group_members_new (device_id, group_id, created_at)
SELECT m.new_id, dgm.group_id, dgm.created_at
FROM device_group_members dgm
JOIN device_id_map m ON dgm.device_id = m.old_id;

-- ============================================================
-- 5. Recreate ipam_ip_addresses with INTEGER device_id
-- ============================================================

CREATE TABLE ipam_ip_addresses_new (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    address_int INTEGER NOT NULL,
    prefix_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    role_id TEXT DEFAULT NULL,
    dns_name TEXT DEFAULT '',
    device_id INTEGER DEFAULT NULL,
    interface_name TEXT DEFAULT '',
    vrf_id TEXT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES devices_new(id) ON DELETE SET NULL
);

INSERT INTO ipam_ip_addresses_new (id, address, address_int, prefix_id, description, status,
    role_id, dns_name, device_id, interface_name, vrf_id, created_at, updated_at)
SELECT ip.id, ip.address, ip.address_int, ip.prefix_id, ip.description, ip.status,
    ip.role_id, ip.dns_name, m.new_id, ip.interface_name, ip.vrf_id, ip.created_at, ip.updated_at
FROM ipam_ip_addresses ip
LEFT JOIN device_id_map m ON ip.device_id = m.old_id;

-- ============================================================
-- 6. Recreate jobs with INTEGER device_id
-- ============================================================

CREATE TABLE jobs_new (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    device_id INTEGER NOT NULL DEFAULT 0,
    command TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    credential_id TEXT DEFAULT ''
);

INSERT INTO jobs_new (id, job_type, device_id, command, status, output, error,
    created_at, started_at, completed_at, credential_id)
SELECT j.id, j.job_type, COALESCE(m.new_id, 0), j.command, j.status, j.output, j.error,
    j.created_at, j.started_at, j.completed_at, j.credential_id
FROM jobs j
LEFT JOIN device_id_map m ON j.device_id = m.old_id;

-- ============================================================
-- 7. Recreate device_port_assignments with INTEGER device_id columns
-- ============================================================

CREATE TABLE device_port_assignments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    port_name TEXT NOT NULL,
    remote_device_id INTEGER,
    remote_port_name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    patch_panel_a_id INTEGER REFERENCES devices_new(id) ON DELETE SET NULL,
    patch_panel_a_port TEXT DEFAULT '',
    patch_panel_b_id INTEGER REFERENCES devices_new(id) ON DELETE SET NULL,
    patch_panel_b_port TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices_new(id) ON DELETE CASCADE,
    FOREIGN KEY (remote_device_id) REFERENCES devices_new(id) ON DELETE SET NULL,
    UNIQUE(device_id, port_name)
);

INSERT INTO device_port_assignments_new (id, device_id, port_name, remote_device_id, remote_port_name,
    description, patch_panel_a_id, patch_panel_a_port, patch_panel_b_id, patch_panel_b_port,
    created_at, updated_at)
SELECT pa.id, m_dev.new_id, pa.port_name, m_remote.new_id, pa.remote_port_name,
    pa.description, m_ppa.new_id, pa.patch_panel_a_port, m_ppb.new_id, pa.patch_panel_b_port,
    pa.created_at, pa.updated_at
FROM device_port_assignments pa
JOIN device_id_map m_dev ON pa.device_id = m_dev.old_id
LEFT JOIN device_id_map m_remote ON pa.remote_device_id = m_remote.old_id
LEFT JOIN device_id_map m_ppa ON pa.patch_panel_a_id = m_ppa.old_id
LEFT JOIN device_id_map m_ppb ON pa.patch_panel_b_id = m_ppb.old_id;

-- ============================================================
-- 8. Preserve ipam_ip_address_roles before dropping ipam_ip_addresses
-- ============================================================

CREATE TEMP TABLE ipam_ip_address_roles_backup AS
SELECT * FROM ipam_ip_address_roles;

-- ============================================================
-- 9. Drop old tables and rename new ones
-- ============================================================

DROP TABLE IF EXISTS device_port_assignments;
DROP TABLE IF EXISTS device_group_members;
DROP TABLE IF EXISTS device_variables;
DROP TABLE IF EXISTS backups;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS ipam_ip_address_roles;
DROP TABLE IF EXISTS ipam_ip_addresses;
DROP TABLE IF EXISTS devices;

ALTER TABLE devices_new RENAME TO devices;
ALTER TABLE backups_new RENAME TO backups;
ALTER TABLE device_variables_new RENAME TO device_variables;
ALTER TABLE device_group_members_new RENAME TO device_group_members;
ALTER TABLE ipam_ip_addresses_new RENAME TO ipam_ip_addresses;
ALTER TABLE jobs_new RENAME TO jobs;
ALTER TABLE device_port_assignments_new RENAME TO device_port_assignments;

-- ============================================================
-- 10. Restore ipam_ip_address_roles
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_ip_address_roles (
    ip_address_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (ip_address_id, role_id),
    FOREIGN KEY (ip_address_id) REFERENCES ipam_ip_addresses(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE CASCADE
);

INSERT INTO ipam_ip_address_roles SELECT * FROM ipam_ip_address_roles_backup;
DROP TABLE ipam_ip_address_roles_backup;

-- ============================================================
-- 11. Recreate all indexes
-- ============================================================

-- devices indexes
CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac);
CREATE INDEX IF NOT EXISTS idx_devices_topology ON devices(topology_id);
CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);

-- backups indexes
CREATE INDEX IF NOT EXISTS idx_backups_device ON backups(device_id);

-- device_variables indexes
CREATE INDEX IF NOT EXISTS idx_device_variables_device ON device_variables(device_id);
CREATE INDEX IF NOT EXISTS idx_device_variables_key ON device_variables(key);

-- device_group_members indexes
CREATE INDEX IF NOT EXISTS idx_dgm_device ON device_group_members(device_id);
CREATE INDEX IF NOT EXISTS idx_dgm_group ON device_group_members(group_id);

-- ipam_ip_addresses indexes
CREATE INDEX IF NOT EXISTS idx_ipam_ips_prefix ON ipam_ip_addresses(prefix_id);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_address ON ipam_ip_addresses(address_int);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_status ON ipam_ip_addresses(status);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_device_id ON ipam_ip_addresses(device_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipam_ips_unique_addr ON ipam_ip_addresses(address_int, prefix_id);

-- jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- device_port_assignments indexes
CREATE INDEX IF NOT EXISTS idx_port_assignments_device ON device_port_assignments(device_id);
CREATE INDEX IF NOT EXISTS idx_port_assignments_remote ON device_port_assignments(remote_device_id);

-- ============================================================
-- 12. Cleanup
-- ============================================================

DROP TABLE IF EXISTS device_id_map;

PRAGMA foreign_keys = ON;
