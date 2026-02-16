-- Migrate vendor ecosystem from TEXT to INTEGER PRIMARY KEY.
-- Order: vendors first (others reference it), then templates, dhcp_options,
-- vendor_actions, device_models.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. Vendors: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE vendors_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    backup_command TEXT DEFAULT 'show running-config',
    deploy_command TEXT DEFAULT '',
    diff_command TEXT DEFAULT '',
    ssh_port INTEGER DEFAULT 22,
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    mac_prefixes TEXT DEFAULT '[]',
    vendor_class TEXT DEFAULT '',
    default_template TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vendors_new (name, backup_command, deploy_command, diff_command, ssh_port, ssh_user, ssh_pass,
    mac_prefixes, vendor_class, default_template, created_at, updated_at)
SELECT name, backup_command, deploy_command, diff_command, ssh_port, ssh_user, ssh_pass,
    mac_prefixes, vendor_class, default_template, created_at, updated_at
FROM vendors
ORDER BY created_at, id;

CREATE TEMP TABLE vendor_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM vendors old
JOIN vendors_new new ON old.name = new.name;

-- Update devices.vendor (TEXT column stores vendor slug, not FK — update to new integer as text)
UPDATE devices SET vendor = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_id_map m WHERE m.old_id = devices.vendor),
    devices.vendor
) WHERE vendor != '' AND EXISTS (SELECT 1 FROM vendor_id_map m WHERE m.old_id = devices.vendor);

-- ============================================================
-- 2. Templates: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE templates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    vendor_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy templates; vendor_id stays TEXT for now (will be updated after mapping)
INSERT INTO templates_new (name, description, vendor_id, content, created_at, updated_at)
SELECT name, description, vendor_id, content, created_at, updated_at
FROM templates
ORDER BY created_at, id;

CREATE TEMP TABLE template_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM templates old
JOIN templates_new new ON old.name = new.name;

-- Update vendor_id in templates to use new vendor integer ids
UPDATE templates_new SET vendor_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_id_map m WHERE m.old_id = templates_new.vendor_id),
    ''
) WHERE vendor_id != '';

-- Update devices.config_template (TEXT column stores template slug)
UPDATE devices SET config_template = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM template_id_map m WHERE m.old_id = devices.config_template),
    devices.config_template
) WHERE config_template != '' AND EXISTS (SELECT 1 FROM template_id_map m WHERE m.old_id = devices.config_template);

-- Update vendors_new.default_template to use new template integer ids
UPDATE vendors_new SET default_template = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM template_id_map m WHERE m.old_id = vendors_new.default_template),
    ''
) WHERE default_template != '';

-- ============================================================
-- 3. DhcpOptions: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE dhcp_options_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT DEFAULT '',
    type TEXT DEFAULT 'string',
    vendor_id INTEGER DEFAULT NULL,
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO dhcp_options_new (option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at)
SELECT option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at
FROM dhcp_options
ORDER BY created_at, id;

-- Update vendor_id to use new vendor integer ids
UPDATE dhcp_options_new SET vendor_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_id_map m WHERE m.old_id = dhcp_options_new.vendor_id),
    ''
) WHERE vendor_id != '';

-- ============================================================
-- 4. VendorActions: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE vendor_actions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    action_type TEXT NOT NULL DEFAULT 'ssh',
    webhook_url TEXT NOT NULL DEFAULT '',
    webhook_method TEXT NOT NULL DEFAULT 'POST',
    webhook_headers TEXT NOT NULL DEFAULT '{}',
    webhook_body TEXT NOT NULL DEFAULT '',
    output_parser_id INTEGER DEFAULT NULL
);

INSERT INTO vendor_actions_new (vendor_id, label, command, sort_order, created_at,
    action_type, webhook_url, webhook_method, webhook_headers, webhook_body, output_parser_id)
SELECT vendor_id, label, command, sort_order, created_at,
    action_type, webhook_url, webhook_method, webhook_headers, webhook_body, output_parser_id
FROM vendor_actions
ORDER BY created_at, id;

CREATE TEMP TABLE vendor_action_id_map AS
SELECT old.id AS old_id, new.id AS new_id
FROM vendor_actions old
JOIN vendor_actions_new new ON old.vendor_id = new.vendor_id AND old.label = new.label;

-- Update vendor_id to use new vendor integer ids
UPDATE vendor_actions_new SET vendor_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_id_map m WHERE m.old_id = vendor_actions_new.vendor_id),
    vendor_actions_new.vendor_id
);

-- Update job_templates.action_id
UPDATE job_templates SET action_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_action_id_map m WHERE m.old_id = job_templates.action_id),
    ''
) WHERE action_id != '';

-- ============================================================
-- 5. DeviceModels: TEXT id → INTEGER id
-- ============================================================

CREATE TABLE device_models_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    display_name TEXT NOT NULL,
    rack_units INTEGER DEFAULT 1,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO device_models_new (vendor_id, model, display_name, rack_units, layout, created_at, updated_at)
SELECT vendor_id, model, display_name, rack_units, layout, created_at, updated_at
FROM device_models
ORDER BY created_at, id;

-- Update vendor_id to use new vendor integer ids
UPDATE device_models_new SET vendor_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM vendor_id_map m WHERE m.old_id = device_models_new.vendor_id),
    device_models_new.vendor_id
);

-- Update device_role_templates.template_id
UPDATE device_role_templates SET template_id = COALESCE(
    (SELECT CAST(m.new_id AS TEXT) FROM template_id_map m WHERE m.old_id = device_role_templates.template_id),
    device_role_templates.template_id
) WHERE EXISTS (SELECT 1 FROM template_id_map m WHERE m.old_id = device_role_templates.template_id);

-- ============================================================
-- 6. Drop old tables and rename new ones
-- ============================================================

DROP TABLE IF EXISTS vendor_actions;
DROP TABLE IF EXISTS dhcp_options;
DROP TABLE IF EXISTS device_models;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS vendors;

ALTER TABLE vendors_new RENAME TO vendors;
ALTER TABLE templates_new RENAME TO templates;
ALTER TABLE dhcp_options_new RENAME TO dhcp_options;
ALTER TABLE vendor_actions_new RENAME TO vendor_actions;
ALTER TABLE device_models_new RENAME TO device_models;

-- ============================================================
-- 7. Recreate indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_templates_vendor ON templates(vendor_id);
CREATE INDEX IF NOT EXISTS idx_dhcp_options_vendor ON dhcp_options(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_actions_vendor ON vendor_actions(vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_models_vendor_model ON device_models(vendor_id, model);

-- ============================================================
-- 8. Cleanup
-- ============================================================

DROP TABLE IF EXISTS vendor_id_map;
DROP TABLE IF EXISTS template_id_map;
DROP TABLE IF EXISTS vendor_action_id_map;

PRAGMA foreign_keys = ON;
