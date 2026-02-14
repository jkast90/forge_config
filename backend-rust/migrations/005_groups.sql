-- Device groups for Ansible-style variable inheritance
-- Groups can be nested (parent_id), have precedence for merge order,
-- and devices can belong to multiple groups via a junction table.

CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    parent_id TEXT DEFAULT NULL,
    precedence INTEGER NOT NULL DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE SET NULL
);

-- Seed the "all" group (root, lowest precedence)
INSERT OR IGNORE INTO groups (id, name, description, parent_id, precedence)
VALUES ('all', 'all', 'Default group — all devices inherit from this', NULL, 0);

CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);

CREATE TABLE IF NOT EXISTS group_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, key)
);

CREATE INDEX IF NOT EXISTS idx_group_variables_group ON group_variables(group_id);
CREATE INDEX IF NOT EXISTS idx_group_variables_key ON group_variables(key);

CREATE TABLE IF NOT EXISTS device_group_members (
    device_mac TEXT NOT NULL,
    group_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_mac, group_id),
    FOREIGN KEY (device_mac) REFERENCES devices(mac) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dgm_device ON device_group_members(device_mac);
CREATE INDEX IF NOT EXISTS idx_dgm_group ON device_group_members(group_id);
