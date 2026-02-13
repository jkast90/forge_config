-- Initial schema: all tables and indexes

CREATE TABLE IF NOT EXISTS devices (
    mac TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    hostname TEXT NOT NULL,
    vendor TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    config_template TEXT DEFAULT '',
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    status TEXT DEFAULT 'offline',
    last_seen DATETIME,
    last_backup DATETIME,
    last_error TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_mac) REFERENCES devices(mac) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_backups_device ON backups(device_mac);

CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    backup_command TEXT DEFAULT 'show running-config',
    deploy_command TEXT DEFAULT '',
    ssh_port INTEGER DEFAULT 22,
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    mac_prefixes TEXT DEFAULT '[]',
    vendor_class TEXT DEFAULT '',
    default_template TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dhcp_options (
    id TEXT PRIMARY KEY,
    option_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT DEFAULT '',
    type TEXT DEFAULT 'string',
    vendor_id TEXT DEFAULT '',
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dhcp_options_vendor ON dhcp_options(vendor_id);

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    vendor_id TEXT DEFAULT '',
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_templates_vendor ON templates(vendor_id);

CREATE TABLE IF NOT EXISTS discovery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    mac TEXT NOT NULL,
    ip TEXT NOT NULL,
    hostname TEXT DEFAULT '',
    vendor TEXT DEFAULT '',
    message TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discovery_logs_mac ON discovery_logs(mac);
CREATE INDEX IF NOT EXISTS idx_discovery_logs_created ON discovery_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS netbox_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    url TEXT DEFAULT '',
    token TEXT DEFAULT '',
    site_id INTEGER DEFAULT 0,
    role_id INTEGER DEFAULT 0,
    sync_enabled INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discovered_devices (
    mac TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    hostname TEXT DEFAULT '',
    vendor TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    vendor_class TEXT DEFAULT '',
    user_class TEXT DEFAULT '',
    dhcp_client_id TEXT DEFAULT '',
    requested_options TEXT DEFAULT '',
    relay_address TEXT DEFAULT '',
    circuit_id TEXT DEFAULT '',
    remote_id TEXT DEFAULT '',
    subscriber_id TEXT DEFAULT '',
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_actions (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_actions_vendor ON vendor_actions(vendor_id);
