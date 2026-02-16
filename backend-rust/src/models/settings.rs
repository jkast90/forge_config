use serde::{Deserialize, Serialize};

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
    // Branding
    #[serde(default)]
    pub app_name: Option<String>,
    #[serde(default)]
    pub logo_url: Option<String>,
    // Device naming
    #[serde(default = "default_hostname_pattern")]
    pub hostname_pattern: String,
    // Topology builder
    #[serde(default = "default_cable_slack_percent")]
    pub cable_slack_percent: i32,
}

fn default_hostname_pattern() -> String {
    "$datacenter-$role-#".to_string()
}
fn default_cable_slack_percent() -> i32 { 20 }

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
            app_name: None,
            logo_url: None,
            hostname_pattern: default_hostname_pattern(),
            cable_slack_percent: default_cable_slack_percent(),
        }
    }
}
