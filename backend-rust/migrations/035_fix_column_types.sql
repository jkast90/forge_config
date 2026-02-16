-- Fix column types that were left as TEXT in earlier migrations but should be INTEGER.
-- This rebuilds affected tables so the SQLite column affinity matches the Rust types.

PRAGMA foreign_keys = OFF;

-- ============================================================
-- 1. topologies: region_id, campus_id, datacenter_id TEXT → INTEGER
-- ============================================================
CREATE TABLE topologies_fix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id INTEGER DEFAULT NULL,
    campus_id INTEGER DEFAULT NULL,
    datacenter_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO topologies_fix (id, name, description, region_id, campus_id, datacenter_id, created_at, updated_at)
SELECT id, name, description,
       CASE WHEN region_id IS NOT NULL AND region_id != '' THEN CAST(region_id AS INTEGER) ELSE NULL END,
       CASE WHEN campus_id IS NOT NULL AND campus_id != '' THEN CAST(campus_id AS INTEGER) ELSE NULL END,
       CASE WHEN datacenter_id IS NOT NULL AND datacenter_id != '' THEN CAST(datacenter_id AS INTEGER) ELSE NULL END,
       created_at, updated_at
FROM topologies;

DROP TABLE topologies;
ALTER TABLE topologies_fix RENAME TO topologies;
CREATE INDEX IF NOT EXISTS idx_devices_topology ON devices(topology_id);

-- ============================================================
-- 2. templates: vendor_id TEXT → INTEGER
-- ============================================================
CREATE TABLE templates_fix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    vendor_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO templates_fix (id, name, description, vendor_id, content, created_at, updated_at)
SELECT id, name, description,
       CASE WHEN vendor_id IS NOT NULL AND vendor_id != '' THEN CAST(vendor_id AS INTEGER) ELSE NULL END,
       content, created_at, updated_at
FROM templates;

DROP TABLE templates;
ALTER TABLE templates_fix RENAME TO templates;
CREATE INDEX IF NOT EXISTS idx_templates_vendor ON templates(vendor_id);

-- ============================================================
-- 3. dhcp_options: vendor_id TEXT → INTEGER
-- ============================================================
CREATE TABLE dhcp_options_fix (
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

INSERT INTO dhcp_options_fix (id, option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at)
SELECT id, option_number, name, value, type,
       CASE WHEN vendor_id IS NOT NULL AND vendor_id != '' THEN CAST(vendor_id AS INTEGER) ELSE NULL END,
       description, enabled, created_at, updated_at
FROM dhcp_options;

DROP TABLE dhcp_options;
ALTER TABLE dhcp_options_fix RENAME TO dhcp_options;
CREATE INDEX IF NOT EXISTS idx_dhcp_options_vendor ON dhcp_options(vendor_id);

-- ============================================================
-- 4. vendor_actions: vendor_id TEXT → INTEGER
-- ============================================================
CREATE TABLE vendor_actions_fix (
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

INSERT INTO vendor_actions_fix (id, vendor_id, label, command, sort_order, created_at,
    action_type, webhook_url, webhook_method, webhook_headers, webhook_body, output_parser_id)
SELECT id, CAST(vendor_id AS INTEGER), label, command, sort_order, created_at,
    action_type, webhook_url, webhook_method, webhook_headers, webhook_body, output_parser_id
FROM vendor_actions;

DROP TABLE vendor_actions;
ALTER TABLE vendor_actions_fix RENAME TO vendor_actions;
CREATE INDEX IF NOT EXISTS idx_vendor_actions_vendor ON vendor_actions(vendor_id);

-- ============================================================
-- 5. device_models: vendor_id TEXT → INTEGER
-- ============================================================
CREATE TABLE device_models_fix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    display_name TEXT NOT NULL,
    rack_units INTEGER DEFAULT 1,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO device_models_fix (id, vendor_id, model, display_name, rack_units, layout, created_at, updated_at)
SELECT id, CAST(vendor_id AS INTEGER), model, display_name, rack_units, layout, created_at, updated_at
FROM device_models;

DROP TABLE device_models;
ALTER TABLE device_models_fix RENAME TO device_models;
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_models_vendor_model ON device_models(vendor_id, model);

-- ============================================================
-- 6. devices: Fix FK columns that have TEXT storage class
--    topology_id stays TEXT (Device model uses Option<String>)
--    hall_id, row_id, rack_id need INTEGER storage class
-- ============================================================
UPDATE devices SET hall_id = CAST(hall_id AS INTEGER) WHERE hall_id IS NOT NULL AND hall_id != '';
UPDATE devices SET row_id = CAST(row_id AS INTEGER) WHERE row_id IS NOT NULL AND row_id != '';
UPDATE devices SET rack_id = CAST(rack_id AS INTEGER) WHERE rack_id IS NOT NULL AND rack_id != '';

PRAGMA foreign_keys = ON;
