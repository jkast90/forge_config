-- Per-device port assignments with remote-end connections
CREATE TABLE IF NOT EXISTS device_port_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    port_name TEXT NOT NULL,
    remote_device_id TEXT,
    remote_port_name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (remote_device_id) REFERENCES devices(id) ON DELETE SET NULL,
    UNIQUE(device_id, port_name)
);

CREATE INDEX IF NOT EXISTS idx_port_assignments_device ON device_port_assignments(device_id);
CREATE INDEX IF NOT EXISTS idx_port_assignments_remote ON device_port_assignments(remote_device_id);
