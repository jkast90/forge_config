use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Canonical device status values
pub mod device_status {
    pub const ONLINE: &str = "online";
    pub const OFFLINE: &str = "offline";
    pub const PROVISIONING: &str = "provisioning";
}

/// Canonical discovery event type values
pub mod discovery_event {
    pub const DISCOVERED: &str = "discovered";
    pub const LEASE_RENEWED: &str = "lease_renewed";
    pub const ADDED: &str = "added";
    pub const LEASE_EXPIRED: &str = "lease_expired";
}

/// Device represents a network device managed by the ZTP server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub mac: String,
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
    pub status: String, // online, offline, provisioning
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
    pub mac: String,
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
}

/// Settings represents global ZTP server settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub default_ssh_user: String,
    pub default_ssh_pass: String,
    pub backup_command: String,
    pub backup_delay: i32, // seconds to wait before backup
    pub dhcp_range_start: String,
    pub dhcp_range_end: String,
    pub dhcp_subnet: String,
    pub dhcp_gateway: String,
    pub tftp_server_ip: String,
    // OpenGear ZTP enrollment options
    #[serde(default)]
    pub opengear_enroll_url: Option<String>,
    #[serde(default)]
    pub opengear_enroll_bundle: Option<String>,
    #[serde(default)]
    pub opengear_enroll_password: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            default_ssh_user: "admin".to_string(),
            default_ssh_pass: "admin".to_string(),
            backup_command: "show running-config".to_string(),
            backup_delay: 30,
            dhcp_range_start: "172.30.0.100".to_string(),
            dhcp_range_end: "172.30.0.200".to_string(),
            dhcp_subnet: "255.255.255.0".to_string(),
            dhcp_gateway: "172.30.0.1".to_string(),
            tftp_server_ip: "172.30.0.2".to_string(),
            opengear_enroll_url: None,
            opengear_enroll_bundle: None,
            opengear_enroll_password: None,
        }
    }
}

/// Backup represents a config backup record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Backup {
    pub id: i64,
    pub device_mac: String,
    pub filename: String,
    pub size: i64,
    pub created_at: DateTime<Utc>,
}

/// Lease represents a DHCP lease from dnsmasq, enriched with DHCP request metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lease {
    pub expiry_time: i64,
    pub mac: String,
    pub ip: String,
    pub hostname: String,
    #[serde(default)]
    pub client_id: Option<String>,
    // Auto-detected vendor ID (from MAC prefix or DHCP vendor class)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    // Derived: model name (from user_class or cpewan_class)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    // Derived: serial number (from cpewan_serial or dhcp_client_id)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub serial_number: Option<String>,
    // DHCP Option 60: vendor class identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_class: Option<String>,
    // DHCP Option 77: user class (may contain model/firmware info)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_class: Option<String>,
    // DHCP Option 61: client identifier (often serial number or DUID)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dhcp_client_id: Option<String>,
    // DHCP options requested by client (comma-separated option numbers, for fingerprinting)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requested_options: Option<String>,
    // Option 82 relay agent info
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relay_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub circuit_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,
}

/// Vendor represents a network device vendor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vendor {
    pub id: String,
    pub name: String,
    pub backup_command: String,
    pub deploy_command: String,
    pub ssh_port: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_pass: Option<String>,
    pub mac_prefixes: Vec<String>,
    pub vendor_class: String,
    pub default_template: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateVendorRequest for creating new vendors
#[derive(Debug, Clone, Deserialize)]
pub struct CreateVendorRequest {
    pub id: String,
    pub name: String,
    #[serde(default = "default_backup_command")]
    pub backup_command: String,
    #[serde(default)]
    pub deploy_command: String,
    #[serde(default = "default_ssh_port")]
    pub ssh_port: i32,
    #[serde(default)]
    pub ssh_user: String,
    #[serde(default)]
    pub ssh_pass: String,
    #[serde(default)]
    pub mac_prefixes: Vec<String>,
    #[serde(default)]
    pub vendor_class: String,
    #[serde(default)]
    pub default_template: String,
}

fn default_backup_command() -> String {
    "show running-config".to_string()
}

fn default_ssh_port() -> i32 {
    22
}

/// DhcpOption represents a DHCP option configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DhcpOption {
    pub id: String,
    pub option_number: i32,
    pub name: String,
    pub value: String,
    #[serde(rename = "type")]
    pub option_type: String, // string, ip, hex, number
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateDhcpOptionRequest for creating new DHCP options
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDhcpOptionRequest {
    pub id: String,
    pub option_number: i32,
    pub name: String,
    #[serde(default)]
    pub value: String,
    #[serde(rename = "type", default = "default_option_type")]
    pub option_type: String,
    #[serde(default)]
    pub vendor_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_option_type() -> String {
    "string".to_string()
}

fn default_enabled() -> bool {
    true
}

/// Template represents a configuration template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateTemplateRequest for creating new templates
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTemplateRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub vendor_id: Option<String>,
    pub content: String,
}

/// DiscoveryLog represents a discovery event log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveryLog {
    pub id: i64,
    pub event_type: String, // discovered, added, lease_renewed, lease_expired
    pub mac: String,
    pub ip: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vendor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// CreateDiscoveryLogRequest for creating new discovery logs
#[derive(Debug, Clone, Deserialize)]
pub struct CreateDiscoveryLogRequest {
    pub event_type: String,
    pub mac: String,
    pub ip: String,
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

/// NetBoxConfig holds the NetBox integration settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NetBoxConfig {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub token: String,
    #[serde(default)]
    pub site_id: i32,
    #[serde(default)]
    pub role_id: i32,
    #[serde(default)]
    pub sync_enabled: bool,
}

/// NetworkInterface represents a network interface with its addresses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub addresses: Vec<String>,
    pub is_up: bool,
    pub is_loopback: bool,
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
    pub template_id: String,
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

/// TemplatePreviewDevice contains the device fields for preview
#[derive(Debug, Clone, Deserialize)]
pub struct TemplatePreviewDevice {
    #[serde(default)]
    pub mac: String,
    #[serde(default)]
    pub ip: String,
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub vendor: Option<String>,
    #[serde(default)]
    pub serial_number: Option<String>,
    #[serde(default)]
    pub ssh_user: Option<String>,
    #[serde(default)]
    pub ssh_pass: Option<String>,
}

/// TemplatePreviewRequest for previewing a template with device data
#[derive(Debug, Clone, Deserialize)]
pub struct TemplatePreviewRequest {
    pub device: TemplatePreviewDevice,
    #[serde(default)]
    pub subnet: String,
    #[serde(default)]
    pub gateway: String,
}

/// TemplatePreviewResponse wraps the rendered output
#[derive(Debug, Clone, Serialize)]
pub struct TemplatePreviewResponse {
    pub output: String,
}

/// TemplateVariable represents a single available template variable
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateVariable {
    pub name: String,
    pub description: String,
    pub example: String,
}
