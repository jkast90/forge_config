use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

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

/// VendorAction represents a quick-action command associated with a vendor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VendorAction {
    pub id: String,
    pub vendor_id: String,
    pub label: String,
    pub command: String,
    pub sort_order: i32,
    pub action_type: String,
    pub webhook_url: String,
    pub webhook_method: String,
    pub webhook_headers: String,
    pub webhook_body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_parser_id: Option<i64>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// CreateVendorActionRequest for creating/updating vendor actions
#[derive(Debug, Clone, Deserialize)]
pub struct CreateVendorActionRequest {
    pub id: String,
    pub vendor_id: String,
    pub label: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default = "default_action_type")]
    pub action_type: String,
    #[serde(default)]
    pub webhook_url: String,
    #[serde(default = "default_webhook_method")]
    pub webhook_method: String,
    #[serde(default = "default_webhook_headers")]
    pub webhook_headers: String,
    #[serde(default)]
    pub webhook_body: String,
    #[serde(default)]
    pub output_parser_id: Option<i64>,
}

fn default_action_type() -> String {
    "ssh".to_string()
}

fn default_webhook_method() -> String {
    "POST".to_string()
}

fn default_webhook_headers() -> String {
    "{}".to_string()
}

/// ExecRequest for executing a command on a device via SSH or webhook
#[derive(Debug, Clone, Deserialize)]
pub struct ExecRequest {
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub action_id: Option<String>,
}

/// ExecResponse returned after executing a command
#[derive(Debug, Clone, Serialize)]
pub struct ExecResponse {
    pub output: Option<String>,
    pub error: Option<String>,
}
