-- Migrate users, credentials, and topologies from TEXT to INTEGER PRIMARY KEY.
-- Pattern: create new table, copy data, build mapping, update dependents, swap.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. Users: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (username, password_hash, enabled, created_at, updated_at)
SELECT username, password_hash, 1, created_at, updated_at
FROM users
ORDER BY created_at, id;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

-- ============================================================
-- 2. Credentials: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE credentials_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cred_type TEXT NOT NULL DEFAULT 'ssh',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO credentials_new (name, description, cred_type, username, password, created_at, updated_at)
SELECT name, description, cred_type, username, password, created_at, updated_at
FROM credentials
ORDER BY created_at, id;

-- Build mapping for credential references
CREATE TEMP TABLE credential_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM credentials old
JOIN credentials_new new ON old.name = new.name;

-- Update jobs.credential_id (TEXT → TEXT representation of INTEGER)
-- jobs.credential_id is TEXT DEFAULT '' so we store the integer as text
UPDATE jobs SET credential_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM credential_id_map m WHERE m.old_id = jobs.credential_id),
    ''
) WHERE credential_id != '';

-- Update job_templates.credential_id (TEXT → TEXT representation of INTEGER)
UPDATE job_templates SET credential_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM credential_id_map m WHERE m.old_id = job_templates.credential_id),
    ''
) WHERE credential_id != '';

DROP TABLE credentials;
ALTER TABLE credentials_new RENAME TO credentials;
DROP TABLE IF EXISTS credential_id_map;

-- ============================================================
-- 3. Topologies: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE topologies_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id INTEGER DEFAULT NULL,
    campus_id INTEGER DEFAULT NULL,
    datacenter_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO topologies_new (name, description, region_id, campus_id, datacenter_id, created_at, updated_at)
SELECT name, description, region_id, campus_id, datacenter_id, created_at, updated_at
FROM topologies
ORDER BY created_at, id;

-- Build mapping for topology references
CREATE TEMP TABLE topology_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM topologies old
JOIN topologies_new new ON old.name = new.name;

-- Update devices.topology_id (TEXT → TEXT representation of INTEGER)
UPDATE devices SET topology_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM topology_id_map m WHERE m.old_id = devices.topology_id),
    ''
) WHERE topology_id != '';

DROP TABLE topologies;
ALTER TABLE topologies_new RENAME TO topologies;
DROP TABLE IF EXISTS topology_id_map;

-- ============================================================
-- 4. Recreate indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_devices_topology ON devices(topology_id);

PRAGMA foreign_keys = ON;
