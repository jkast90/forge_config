-- Add proper 'id' primary key to devices, replacing mac as PK.
-- SQLite does not support ALTER TABLE ... ADD PRIMARY KEY, so we rebuild affected tables.

-- Step 1: Add 'id' column to devices (populated from mac initially)
ALTER TABLE devices ADD COLUMN id TEXT DEFAULT '';

-- Populate id with a slug of the mac (e.g., "aa:bb:cc:dd:ee:ff" -> "aabbccddeeff")
UPDATE devices SET id = REPLACE(mac, ':', '');

-- Step 2: Recreate devices table with id as PK
CREATE TABLE devices_new (
    id TEXT PRIMARY KEY,
    mac TEXT NOT NULL UNIQUE,
    ip TEXT NOT NULL,
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
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO devices_new (id, mac, ip, hostname, vendor, model, serial_number, config_template,
    ssh_user, ssh_pass, topology_id, topology_role, status, last_seen, last_backup, last_error,
    created_at, updated_at)
SELECT REPLACE(mac, ':', ''), mac, ip, hostname, vendor, model, serial_number, config_template,
    ssh_user, ssh_pass, topology_id, topology_role, status, last_seen, last_backup, last_error,
    created_at, updated_at
FROM devices;

DROP TABLE devices;
ALTER TABLE devices_new RENAME TO devices;
CREATE INDEX IF NOT EXISTS idx_devices_topology ON devices(topology_id);
CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac);

-- Step 3: Add device_id column to backups and populate
ALTER TABLE backups ADD COLUMN device_id TEXT DEFAULT '';
UPDATE backups SET device_id = (SELECT REPLACE(mac, ':', '') FROM devices WHERE devices.mac = backups.device_mac);

-- Step 4: Recreate backups with device_id FK
CREATE TABLE backups_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
INSERT INTO backups_new (id, device_id, filename, size, created_at)
SELECT id, device_id, filename, size, created_at FROM backups;
DROP TABLE backups;
ALTER TABLE backups_new RENAME TO backups;
CREATE INDEX IF NOT EXISTS idx_backups_device ON backups(device_id);

-- Step 5: Recreate device_variables with device_id
CREATE TABLE device_variables_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(device_id, key)
);
INSERT INTO device_variables_new (id, device_id, key, value, created_at, updated_at)
SELECT dv.id, REPLACE(dv.device_mac, ':', ''), dv.key, dv.value, dv.created_at, dv.updated_at
FROM device_variables dv;
DROP TABLE device_variables;
ALTER TABLE device_variables_new RENAME TO device_variables;
CREATE INDEX IF NOT EXISTS idx_device_variables_device ON device_variables(device_id);
CREATE INDEX IF NOT EXISTS idx_device_variables_key ON device_variables(key);

-- Step 6: Recreate device_group_members with device_id
CREATE TABLE device_group_members_new (
    device_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, group_id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
INSERT INTO device_group_members_new (device_id, group_id, created_at)
SELECT REPLACE(dgm.device_mac, ':', ''), dgm.group_id, dgm.created_at
FROM device_group_members dgm;
DROP TABLE device_group_members;
ALTER TABLE device_group_members_new RENAME TO device_group_members;
CREATE INDEX IF NOT EXISTS idx_dgm_device ON device_group_members(device_id);
CREATE INDEX IF NOT EXISTS idx_dgm_group ON device_group_members(group_id);

-- Step 7: Add device_id to ipam_ip_addresses and populate
ALTER TABLE ipam_ip_addresses ADD COLUMN device_id TEXT DEFAULT NULL REFERENCES devices(id) ON DELETE SET NULL;
UPDATE ipam_ip_addresses SET device_id = (
    SELECT REPLACE(mac, ':', '') FROM devices WHERE devices.mac = ipam_ip_addresses.device_mac
) WHERE device_mac IS NOT NULL AND device_mac != '';
CREATE INDEX IF NOT EXISTS idx_ipam_ips_device_id ON ipam_ip_addresses(device_id);

-- Step 8: Recreate jobs with device_id
CREATE TABLE jobs_new (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    device_id TEXT NOT NULL,
    command TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
INSERT INTO jobs_new (id, job_type, device_id, command, status, output, error, created_at, started_at, completed_at)
SELECT j.id, j.job_type, REPLACE(j.device_mac, ':', ''), j.command, j.status, j.output, j.error, j.created_at, j.started_at, j.completed_at
FROM jobs j;
DROP TABLE jobs;
ALTER TABLE jobs_new RENAME TO jobs;
CREATE INDEX IF NOT EXISTS idx_jobs_device ON jobs(device_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);
