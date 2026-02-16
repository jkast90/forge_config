use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuCluster {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub gpu_model: String,
    pub node_count: i32,
    pub gpus_per_node: i32,
    pub interconnect_type: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub topology_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateGpuClusterRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_gpu_model")]
    pub gpu_model: String,
    #[serde(default = "default_node_count")]
    pub node_count: i32,
    #[serde(default = "default_gpus_per_node")]
    pub gpus_per_node: i32,
    #[serde(default = "default_interconnect")]
    pub interconnect_type: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub topology_id: Option<i64>,
    #[serde(default)]
    pub vrf_id: Option<i64>,
}

fn default_gpu_model() -> String { "MI300X".to_string() }
fn default_node_count() -> i32 { 1 }
fn default_gpus_per_node() -> i32 { 8 }
fn default_interconnect() -> String { "InfiniBand".to_string() }
fn default_status() -> String { "provisioning".to_string() }
