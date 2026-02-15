use anyhow::Result;

use crate::models::*;
use super::Store;
use super::ipam;

impl Store {
    // ========== IPAM Region Operations ==========

    pub async fn list_ipam_regions(&self) -> Result<Vec<IpamRegion>> {
        ipam::IpamRegionRepo::list(&self.pool).await
    }

    pub async fn get_ipam_region(&self, id: &str) -> Result<Option<IpamRegion>> {
        ipam::IpamRegionRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_region(&self, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        ipam::IpamRegionRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_region(&self, id: &str, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        ipam::IpamRegionRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_region(&self, id: &str) -> Result<()> {
        ipam::IpamRegionRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Campus Operations ==========

    pub async fn list_ipam_campuses(&self) -> Result<Vec<IpamCampus>> {
        ipam::IpamCampusRepo::list(&self.pool).await
    }

    pub async fn get_ipam_campus(&self, id: &str) -> Result<Option<IpamCampus>> {
        ipam::IpamCampusRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_campus(&self, req: &CreateIpamCampusRequest) -> Result<IpamCampus> {
        ipam::IpamCampusRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_campus(&self, id: &str, req: &CreateIpamCampusRequest) -> Result<IpamCampus> {
        ipam::IpamCampusRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_campus(&self, id: &str) -> Result<()> {
        ipam::IpamCampusRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Datacenter Operations ==========

    pub async fn list_ipam_datacenters(&self) -> Result<Vec<IpamDatacenter>> {
        ipam::IpamDatacenterRepo::list(&self.pool).await
    }

    pub async fn get_ipam_datacenter(&self, id: &str) -> Result<Option<IpamDatacenter>> {
        ipam::IpamDatacenterRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_datacenter(&self, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        ipam::IpamDatacenterRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_datacenter(&self, id: &str, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        ipam::IpamDatacenterRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_datacenter(&self, id: &str) -> Result<()> {
        ipam::IpamDatacenterRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Hall Operations ==========

    pub async fn list_ipam_halls(&self) -> Result<Vec<IpamHall>> {
        ipam::IpamHallRepo::list(&self.pool).await
    }

    pub async fn get_ipam_hall(&self, id: &str) -> Result<Option<IpamHall>> {
        ipam::IpamHallRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_hall(&self, req: &CreateIpamHallRequest) -> Result<IpamHall> {
        ipam::IpamHallRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_hall(&self, id: &str, req: &CreateIpamHallRequest) -> Result<IpamHall> {
        ipam::IpamHallRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_hall(&self, id: &str) -> Result<()> {
        ipam::IpamHallRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Row Operations ==========

    pub async fn list_ipam_rows(&self) -> Result<Vec<IpamRow>> {
        ipam::IpamRowRepo::list(&self.pool).await
    }

    pub async fn get_ipam_row(&self, id: &str) -> Result<Option<IpamRow>> {
        ipam::IpamRowRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_row(&self, req: &CreateIpamRowRequest) -> Result<IpamRow> {
        ipam::IpamRowRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_row(&self, id: &str, req: &CreateIpamRowRequest) -> Result<IpamRow> {
        ipam::IpamRowRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_row(&self, id: &str) -> Result<()> {
        ipam::IpamRowRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Rack Operations ==========

    pub async fn list_ipam_racks(&self) -> Result<Vec<IpamRack>> {
        ipam::IpamRackRepo::list(&self.pool).await
    }

    pub async fn get_ipam_rack(&self, id: &str) -> Result<Option<IpamRack>> {
        ipam::IpamRackRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_rack(&self, req: &CreateIpamRackRequest) -> Result<IpamRack> {
        ipam::IpamRackRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_rack(&self, id: &str, req: &CreateIpamRackRequest) -> Result<IpamRack> {
        ipam::IpamRackRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_rack(&self, id: &str) -> Result<()> {
        ipam::IpamRackRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Role Operations ==========

    pub async fn list_ipam_roles(&self) -> Result<Vec<IpamRole>> {
        ipam::IpamRoleRepo::list(&self.pool).await
    }

    pub async fn create_ipam_role(&self, req: &CreateIpamRoleRequest) -> Result<IpamRole> {
        ipam::IpamRoleRepo::create(&self.pool, req).await
    }

    pub async fn delete_ipam_role(&self, id: &str) -> Result<()> {
        ipam::IpamRoleRepo::delete(&self.pool, id).await
    }

    // ========== IPAM Prefix Operations ==========

    pub async fn list_ipam_prefixes(&self) -> Result<Vec<IpamPrefix>> {
        ipam::IpamPrefixRepo::list(&self.pool).await
    }

    pub async fn list_ipam_supernets(&self) -> Result<Vec<IpamPrefix>> {
        ipam::IpamPrefixRepo::list_supernets(&self.pool).await
    }

    pub async fn get_ipam_prefix(&self, id: i64) -> Result<Option<IpamPrefix>> {
        ipam::IpamPrefixRepo::get(&self.pool, id).await
    }

    pub async fn find_ipam_prefix_by_cidr(&self, cidr: &str, vrf_id: Option<&str>) -> Result<Option<IpamPrefix>> {
        ipam::IpamPrefixRepo::find_by_cidr(&self.pool, cidr, vrf_id).await
    }

    pub async fn create_ipam_prefix(&self, req: &CreateIpamPrefixRequest) -> Result<IpamPrefix> {
        ipam::IpamPrefixRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_prefix(&self, id: i64, req: &CreateIpamPrefixRequest) -> Result<IpamPrefix> {
        ipam::IpamPrefixRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_prefix(&self, id: i64) -> Result<()> {
        ipam::IpamPrefixRepo::delete(&self.pool, id).await
    }

    pub async fn next_available_ipam_prefix(&self, parent_id: i64, req: &NextAvailablePrefixRequest) -> Result<IpamPrefix> {
        ipam::IpamPrefixRepo::next_available_prefix(&self.pool, parent_id, req).await
    }

    // ========== IPAM IP Address Operations ==========

    pub async fn list_ipam_ip_addresses(&self) -> Result<Vec<IpamIpAddress>> {
        ipam::IpamIpAddressRepo::list(&self.pool).await
    }

    pub async fn list_ipam_ip_addresses_by_prefix(&self, prefix_id: i64) -> Result<Vec<IpamIpAddress>> {
        ipam::IpamIpAddressRepo::list_by_prefix(&self.pool, prefix_id).await
    }

    pub async fn get_ipam_ip_address(&self, id: &str) -> Result<Option<IpamIpAddress>> {
        ipam::IpamIpAddressRepo::get(&self.pool, id).await
    }

    pub async fn create_ipam_ip_address(&self, req: &CreateIpamIpAddressRequest) -> Result<IpamIpAddress> {
        ipam::IpamIpAddressRepo::create(&self.pool, req).await
    }

    pub async fn update_ipam_ip_address(&self, id: &str, req: &CreateIpamIpAddressRequest) -> Result<IpamIpAddress> {
        ipam::IpamIpAddressRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_ipam_ip_address(&self, id: &str) -> Result<()> {
        ipam::IpamIpAddressRepo::delete(&self.pool, id).await
    }

    pub async fn next_available_ipam_ip(&self, prefix_id: i64, req: &NextAvailableIpRequest) -> Result<IpamIpAddress> {
        ipam::IpamIpAddressRepo::next_available_ip(&self.pool, prefix_id, req).await
    }

    // ========== IPAM Tag Operations ==========

    pub async fn list_ipam_tags(&self, resource_type: &str, resource_id: &str) -> Result<Vec<IpamTag>> {
        ipam::IpamTagRepo::list_for_resource(&self.pool, resource_type, resource_id).await
    }

    pub async fn set_ipam_tag(&self, resource_type: &str, resource_id: &str, key: &str, value: &str) -> Result<()> {
        ipam::IpamTagRepo::set(&self.pool, resource_type, resource_id, key, value).await
    }

    pub async fn delete_ipam_tag(&self, resource_type: &str, resource_id: &str, key: &str) -> Result<()> {
        ipam::IpamTagRepo::delete(&self.pool, resource_type, resource_id, key).await
    }

    pub async fn list_ipam_tag_keys(&self) -> Result<Vec<String>> {
        ipam::IpamTagRepo::list_distinct_keys(&self.pool).await
    }

    // ========== IPAM VRF Operations ==========

    pub async fn list_ipam_vrfs(&self) -> Result<Vec<IpamVrf>> {
        ipam::IpamVrfRepo::list(&self.pool).await
    }

    pub async fn create_ipam_vrf(&self, req: &CreateIpamVrfRequest) -> Result<IpamVrf> {
        ipam::IpamVrfRepo::create(&self.pool, req).await
    }

    pub async fn delete_ipam_vrf(&self, id: &str) -> Result<()> {
        ipam::IpamVrfRepo::delete(&self.pool, id).await
    }
}
