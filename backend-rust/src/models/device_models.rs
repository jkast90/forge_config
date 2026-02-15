use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceModel {
    pub id: String,
    pub vendor_id: String,
    pub model: String,
    pub display_name: String,
    pub rack_units: i32,
    pub layout: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDeviceModelRequest {
    pub id: String,
    pub vendor_id: String,
    pub model: String,
    pub display_name: String,
    #[serde(default = "default_rack_units")]
    pub rack_units: i32,
    #[serde(default = "default_layout")]
    pub layout: String,
}

fn default_rack_units() -> i32 {
    1
}

fn default_layout() -> String {
    "[]".to_string()
}
