use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// IPAM status values
pub mod ipam_status {
    pub const ACTIVE: &str = "active";
    pub const RESERVED: &str = "reserved";
    pub const DEPRECATED: &str = "deprecated";
    pub const DHCP: &str = "dhcp";
}

/// IPAM resource types (for polymorphic tags)
pub mod ipam_resource_type {
    pub const REGION: &str = "region";
    pub const CAMPUS: &str = "campus";
    pub const DATACENTER: &str = "datacenter";
    pub const PREFIX: &str = "prefix";
    pub const IP_ADDRESS: &str = "ip_address";
    pub const HALL: &str = "hall";
    pub const ROW: &str = "row";
    pub const RACK: &str = "rack";
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamRegion {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campus_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamRegionRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamCampus {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub region_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datacenter_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamCampusRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub region_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamDatacenter {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub campus_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub campus_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub region_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefix_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hall_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamDatacenterRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub campus_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamHall {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub datacenter_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datacenter_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamHallRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub datacenter_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamRow {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub hall_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hall_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rack_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamRowRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub hall_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamRack {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub row_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamRackRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub row_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamRole {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamRoleRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamPrefix {
    pub id: i64,
    pub prefix: String,
    pub network_int: i64,
    pub broadcast_int: i64,
    pub prefix_length: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    pub is_supernet: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_names: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_prefix: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datacenter_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datacenter_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vlan_id: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub child_prefix_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utilization: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn default_ipam_status() -> String {
    "active".to_string()
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamPrefixRequest {
    pub prefix: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_ipam_status")]
    pub status: String,
    #[serde(default)]
    pub is_supernet: bool,
    #[serde(default)]
    pub role_ids: Vec<String>,
    #[serde(default)]
    pub parent_id: Option<i64>,
    #[serde(default)]
    pub datacenter_id: Option<String>,
    #[serde(default)]
    pub vlan_id: Option<i32>,
    #[serde(default)]
    pub vrf_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamIpAddress {
    pub id: String,
    pub address: String,
    pub address_int: i64,
    pub prefix_id: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_names: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dns_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vrf_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamIpAddressRequest {
    pub id: String,
    pub address: String,
    pub prefix_id: i64,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_ipam_status")]
    pub status: String,
    #[serde(default)]
    pub role_ids: Vec<String>,
    #[serde(default)]
    pub dns_name: Option<String>,
    #[serde(default)]
    pub device_id: Option<i64>,
    #[serde(default)]
    pub interface_name: Option<String>,
    #[serde(default)]
    pub vrf_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamTag {
    pub id: i64,
    pub resource_type: String,
    pub resource_id: String,
    pub key: String,
    pub value: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetIpamTagRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NextAvailablePrefixRequest {
    pub prefix_length: i32,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_ipam_status")]
    pub status: String,
    #[serde(default)]
    pub datacenter_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NextAvailableIpRequest {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_ipam_status")]
    pub status: String,
    #[serde(default)]
    pub role_ids: Vec<String>,
    #[serde(default)]
    pub dns_name: Option<String>,
    #[serde(default)]
    pub device_id: Option<i64>,
    #[serde(default)]
    pub interface_name: Option<String>,
}

// ========== VRF ==========

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpamVrf {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rd: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prefix_count: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIpamVrfRequest {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub rd: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}
