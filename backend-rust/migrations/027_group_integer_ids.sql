-- Migrate group IDs from TEXT to INTEGER AUTOINCREMENT

-- 1. Create new groups table with INTEGER id
CREATE TABLE groups_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    parent_id INTEGER DEFAULT NULL,
    precedence INTEGER NOT NULL DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES groups_new(id) ON DELETE SET NULL
);

-- 2. Insert 'all' group first to guarantee it gets id=1
INSERT INTO groups_new (name, description, parent_id, precedence, created_at, updated_at)
SELECT name, description, NULL, precedence, created_at, updated_at
FROM groups WHERE id = 'all';

-- 3. Insert remaining groups (parent_id resolved later)
INSERT INTO groups_new (name, description, parent_id, precedence, created_at, updated_at)
SELECT name, description, NULL, precedence, created_at, updated_at
FROM groups WHERE id != 'all';

-- 4. Build mapping: old TEXT id → new INTEGER id
CREATE TEMP TABLE group_id_map AS
SELECT g.id AS old_id, gn.id AS new_id
FROM groups g
JOIN groups_new gn ON gn.name = g.name;

-- 5. Resolve parent_id references using the mapping
UPDATE groups_new SET parent_id = (
    SELECT m2.new_id
    FROM group_id_map m1
    JOIN groups g ON g.id = m1.old_id
    JOIN group_id_map m2 ON m2.old_id = g.parent_id
    WHERE m1.new_id = groups_new.id
)
WHERE EXISTS (
    SELECT 1
    FROM group_id_map m1
    JOIN groups g ON g.id = m1.old_id
    WHERE m1.new_id = groups_new.id AND g.parent_id IS NOT NULL AND g.parent_id != ''
);

-- 6. Recreate group_variables with integer group_id
CREATE TABLE group_variables_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups_new(id) ON DELETE CASCADE,
    UNIQUE(group_id, key)
);
INSERT INTO group_variables_new (group_id, key, value, created_at, updated_at)
SELECT m.new_id, gv.key, gv.value, gv.created_at, gv.updated_at
FROM group_variables gv
JOIN group_id_map m ON m.old_id = gv.group_id;

-- 7. Recreate device_group_members with integer group_id
CREATE TABLE device_group_members_new (
    device_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, group_id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups_new(id) ON DELETE CASCADE
);
INSERT INTO device_group_members_new (device_id, group_id, created_at)
SELECT dgm.device_id, m.new_id, dgm.created_at
FROM device_group_members dgm
JOIN group_id_map m ON m.old_id = dgm.group_id;

-- 8. Update job_templates target_group_id TEXT values to new integer IDs (stored as TEXT)
UPDATE job_templates SET target_group_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM group_id_map m WHERE m.old_id = job_templates.target_group_id),
    ''
) WHERE target_group_id != '';

-- 9. Swap tables
DROP TABLE device_group_members;
DROP TABLE group_variables;
DROP TABLE groups;
ALTER TABLE groups_new RENAME TO groups;
ALTER TABLE group_variables_new RENAME TO group_variables;
ALTER TABLE device_group_members_new RENAME TO device_group_members;

-- 10. Recreate indexes
CREATE INDEX idx_groups_parent ON groups(parent_id);
CREATE INDEX idx_group_variables_group ON group_variables(group_id);
CREATE INDEX idx_group_variables_key ON group_variables(key);
CREATE INDEX idx_dgm_device ON device_group_members(device_id);
CREATE INDEX idx_dgm_group ON device_group_members(group_id);

DROP TABLE group_id_map;
