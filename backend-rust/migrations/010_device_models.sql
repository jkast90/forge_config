-- Device model definitions (chassis port layouts)
CREATE TABLE IF NOT EXISTS device_models (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    model TEXT NOT NULL,
    display_name TEXT NOT NULL,
    rack_units INTEGER DEFAULT 1,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_models_vendor_model ON device_models(vendor_id, model);
