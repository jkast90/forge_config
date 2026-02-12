use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// --- NetBox API types ---

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub count: i32,
    pub next: Option<String>,
    pub previous: Option<String>,
    pub results: Vec<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NestedRef {
    pub id: i32,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub display: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusChoice {
    pub value: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbManufacturer {
    pub id: i32,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbSite {
    pub id: i32,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub status: Option<StatusChoice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbDeviceRole {
    pub id: i32,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbDeviceType {
    pub id: i32,
    pub model: String,
    pub slug: String,
    #[serde(default)]
    pub manufacturer: Option<NestedRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbDevice {
    pub id: i32,
    pub name: Option<String>,
    #[serde(default)]
    pub device_type: Option<NestedRef>,
    #[serde(default)]
    pub role: Option<NestedRef>,
    #[serde(default)]
    pub site: Option<NestedRef>,
    #[serde(default)]
    pub status: Option<StatusChoice>,
    #[serde(default)]
    pub serial: String,
    #[serde(default)]
    pub primary_ip4: Option<NbIPAddress>,
    #[serde(default)]
    pub custom_fields: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbInterface {
    pub id: i32,
    pub name: String,
    #[serde(default)]
    pub mac_address: Option<String>,
    #[serde(default)]
    pub device: Option<NestedRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NbIPAddress {
    pub id: i32,
    pub address: String,
    #[serde(default)]
    pub display: Option<String>,
}

// --- Create request types ---

#[derive(Debug, Serialize)]
pub(crate) struct ManufacturerCreate {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct SiteCreate {
    pub name: String,
    pub slug: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct DeviceRoleCreate {
    pub name: String,
    pub slug: String,
    pub color: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct DeviceTypeCreate {
    pub manufacturer: i32,
    pub model: String,
    pub slug: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct DeviceCreate {
    pub name: String,
    pub device_type: i32,
    pub role: i32,
    pub site: i32,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
pub(crate) struct InterfaceCreate {
    pub device: i32,
    pub name: String,
    #[serde(rename = "type")]
    pub iface_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mac_address: Option<String>,
}

// --- Sync result ---

#[derive(Debug, Clone, Serialize)]
pub struct SyncResult {
    pub message: String,
    pub result: SyncCounts,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncCounts {
    pub created: i32,
    pub updated: i32,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<String>,
}
