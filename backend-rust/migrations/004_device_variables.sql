-- Device variables: freeform key-value pairs per device
-- Used in template rendering as {{vars.KeyName}}
CREATE TABLE IF NOT EXISTS device_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_mac TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_mac) REFERENCES devices(mac) ON DELETE CASCADE,
    UNIQUE(device_mac, key)
);
CREATE INDEX IF NOT EXISTS idx_device_variables_mac ON device_variables(device_mac);
CREATE INDEX IF NOT EXISTS idx_device_variables_key ON device_variables(key);
