use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Canonical discovery event type values
pub mod discovery_event {
    pub const DISCOVERED: &str = "discovered";
    pub const LEASE_RENEWED: &str = "lease_renewed";
    pub const ADDED: &str = "added";
    pub const LEASE_EXPIRED: &str = "lease_expired";
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
