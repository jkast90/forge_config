use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// PortAssignment represents a per-device port connection to a remote end
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortAssignment {
    pub id: i64,
    pub device_id: i64,
    pub port_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_device_id: Option<i64>,
    pub remote_port_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_a_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_a_port: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_b_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_b_port: Option<String>,
    // Enriched via JOIN (not stored)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_device_hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_device_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_a_hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_panel_b_hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_id: Option<String>,
    // Enriched via JOIN (not stored)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// SetPortAssignmentRequest for creating/updating a port assignment
#[derive(Debug, Clone, Deserialize)]
pub struct SetPortAssignmentRequest {
    pub port_name: String,
    #[serde(default)]
    pub remote_device_id: Option<i64>,
    #[serde(default)]
    pub remote_port_name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub patch_panel_a_id: Option<i64>,
    #[serde(default)]
    pub patch_panel_a_port: Option<String>,
    #[serde(default)]
    pub patch_panel_b_id: Option<i64>,
    #[serde(default)]
    pub patch_panel_b_port: Option<String>,
    #[serde(default)]
    pub vrf_id: Option<String>,
}

/// BulkPortAssignmentRequest for replacing all assignments for a device
#[derive(Debug, Clone, Deserialize)]
pub struct BulkPortAssignmentRequest {
    pub assignments: Vec<SetPortAssignmentRequest>,
}
