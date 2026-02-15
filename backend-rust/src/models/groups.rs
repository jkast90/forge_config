use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// DeviceVariable represents a key-value pair associated with a device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceVariable {
    pub id: i64,
    pub device_id: i64,
    pub key: String,
    pub value: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Group represents a device group for Ansible-style variable inheritance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub precedence: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub child_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// CreateGroupRequest for creating/updating device groups
#[derive(Debug, Clone, Deserialize)]
pub struct CreateGroupRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default = "default_precedence")]
    pub precedence: i32,
}

fn default_precedence() -> i32 {
    1000
}

/// GroupVariable is a key-value pair on a group
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupVariable {
    pub id: i64,
    pub group_id: String,
    pub key: String,
    pub value: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A resolved variable with provenance (which layer set it)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedVariable {
    pub key: String,
    pub value: String,
    pub source: String,
    pub source_name: String,
    pub source_type: String,
}

/// One layer in the resolution stack
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionLayer {
    pub source: String,
    pub source_name: String,
    pub source_type: String,
    pub precedence: i32,
    pub variables: HashMap<String, String>,
}

/// Full resolution result — used by the inspector API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedVariablesResponse {
    pub variables: HashMap<String, String>,
    pub resolved: Vec<ResolvedVariable>,
    pub resolution_order: Vec<ResolutionLayer>,
}
