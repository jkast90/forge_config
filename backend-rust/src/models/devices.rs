use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Canonical device status values
pub mod device_status {
    pub const ONLINE: &str = "online";
    pub const OFFLINE: &str = "offline";
    pub const PROVISIONING: &str = "provisioning";
}

/// Device represents a network device managed by the ZTP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: i64,
    pub mac: Option<String>,
    pub ip: String,
    pub hostname: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    pub config_template: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_pass: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topology_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topology_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hall_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack_position: Option<i32>,
    pub status: String, // online, offline, provisioning
    pub device_type: String, // internal, external
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_backup: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateDeviceRequest for creating new devices
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDeviceRequest {
    #[serde(default)]
    pub mac: String,
    #[serde(default)]
    pub ip: String,
    pub hostname: String,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub serial_number: Option<String>,
    #[serde(default)]
    pub config_template: String,
    #[serde(default)]
    pub ssh_user: Option<String>,
    #[serde(default)]
    pub ssh_pass: Option<String>,
    #[serde(default)]
    pub topology_id: Option<i64>,
    #[serde(default)]
    pub topology_role: Option<String>,
    #[serde(default)]
    pub hall_id: Option<i64>,
    #[serde(default)]
    pub row_id: Option<i64>,
    #[serde(default)]
    pub rack_id: Option<i64>,
    #[serde(default)]
    pub rack_position: Option<i32>,
    #[serde(default)]
    pub device_type: Option<String>,
}

/// UpdateDeviceRequest for updating devices
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDeviceRequest {
    pub ip: String,
    pub hostname: String,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub serial_number: Option<String>,
    #[serde(default)]
    pub config_template: String,
    #[serde(default)]
    pub ssh_user: Option<String>,
    #[serde(default)]
    pub ssh_pass: Option<String>,
    #[serde(default)]
    pub topology_id: Option<i64>,
    #[serde(default)]
    pub topology_role: Option<String>,
    #[serde(default)]
    pub hall_id: Option<i64>,
    #[serde(default)]
    pub row_id: Option<i64>,
    #[serde(default)]
    pub rack_id: Option<i64>,
    #[serde(default)]
    pub rack_position: Option<i32>,
    #[serde(default)]
    pub device_type: Option<String>,
}

/// Backup represents a config backup record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: i64,
    pub device_id: i64,
    pub filename: String,
    pub size: i64,
    pub created_at: DateTime<Utc>,
}

/// ConnectResult represents the result of a device connectivity check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResult {
    pub ping: PingResult,
    pub ssh: SshResult,
    pub success: bool,
}

/// PingResult represents the ping check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingResult {
    pub reachable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// SshResult represents the SSH connection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshResult {
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interfaces: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// ConnectIpRequest for testing connectivity to an arbitrary IP
#[derive(Debug, Clone, Deserialize)]
pub struct ConnectIpRequest {
    pub ip: String,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub ssh_user: Option<String>,
    #[serde(default)]
    pub ssh_pass: Option<String>,
}

/// DeviceConfigResponse represents a device's generated configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfigResponse {
    pub mac: String,
    pub hostname: String,
    pub filename: String,
    pub content: String,
    pub exists: bool,
}

/// DeviceConfigPreviewResponse represents a rendered template preview for a device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceConfigPreviewResponse {
    pub mac: String,
    pub hostname: String,
    pub template_id: i64,
    pub template_name: String,
    pub content: String,
}

/// DeployConfigResponse represents the result of deploying config to a device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployConfigResponse {
    pub mac: String,
    pub hostname: String,
    pub success: bool,
    pub output: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
