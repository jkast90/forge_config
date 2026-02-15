use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Canonical CLOS topology role values
pub mod topology_role {
    pub const SUPER_SPINE: &str = "super-spine";
    pub const SPINE: &str = "spine";
    pub const LEAF: &str = "leaf";

    pub const ALL: &[&str] = &[SUPER_SPINE, SPINE, LEAF];

    pub fn is_valid(role: &str) -> bool {
        role.is_empty() || ALL.contains(&role)
    }
}

/// Topology represents a named CLOS fabric topology
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topology {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campus_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datacenter_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub super_spine_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spine_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaf_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateTopologyRequest for creating new topologies
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTopologyRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub region_id: Option<i64>,
    #[serde(default)]
    pub campus_id: Option<i64>,
    #[serde(default)]
    pub datacenter_id: Option<i64>,
}
