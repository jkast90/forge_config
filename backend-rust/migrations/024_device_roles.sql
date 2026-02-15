-- Device roles with associated templates
-- Roles are user-defined (e.g., core-router, access-switch, border-leaf)
-- Each role can have one or more templates assigned to it

CREATE TABLE IF NOT EXISTS device_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction table: which templates are associated with each role
CREATE TABLE IF NOT EXISTS device_role_templates (
    role_id TEXT NOT NULL REFERENCES device_roles(id) ON DELETE CASCADE,
    template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (role_id, template_id)
);
