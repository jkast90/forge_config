use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;
use super::{created, ApiError};

// ========== Regions ==========

pub async fn list_regions(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamRegion>>, ApiError> {
    let regions = state.store.list_ipam_regions().await?;
    Ok(Json(regions))
}

pub async fn get_region(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<IpamRegion>, ApiError> {
    let region = state.store.get_ipam_region(&id).await?
        .ok_or_else(|| ApiError::not_found("Region"))?;
    Ok(Json(region))
}

pub async fn create_region(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamRegionRequest>,
) -> Result<(StatusCode, Json<IpamRegion>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() {
        return Err(ApiError::bad_request("id and name are required"));
    }
    if state.store.get_ipam_region(&req.id).await?.is_some() {
        return Err(ApiError::conflict("Region with this ID already exists"));
    }
    let region = state.store.create_ipam_region(&req).await?;
    Ok(created(region))
}

pub async fn update_region(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateIpamRegionRequest>,
) -> Result<Json<IpamRegion>, ApiError> {
    req.id = id.clone();
    let region = state.store.update_ipam_region(&id, &req).await?;
    Ok(Json(region))
}

pub async fn delete_region(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_region(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ========== Locations ==========

pub async fn list_locations(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamLocation>>, ApiError> {
    let locations = state.store.list_ipam_locations().await?;
    Ok(Json(locations))
}

pub async fn get_location(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<IpamLocation>, ApiError> {
    let location = state.store.get_ipam_location(&id).await?
        .ok_or_else(|| ApiError::not_found("Location"))?;
    Ok(Json(location))
}

pub async fn create_location(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamLocationRequest>,
) -> Result<(StatusCode, Json<IpamLocation>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() || req.region_id.is_empty() {
        return Err(ApiError::bad_request("id, name, and region_id are required"));
    }
    if state.store.get_ipam_location(&req.id).await?.is_some() {
        return Err(ApiError::conflict("Location with this ID already exists"));
    }
    if state.store.get_ipam_region(&req.region_id).await?.is_none() {
        return Err(ApiError::bad_request("Region not found"));
    }
    let location = state.store.create_ipam_location(&req).await?;
    Ok(created(location))
}

pub async fn update_location(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateIpamLocationRequest>,
) -> Result<Json<IpamLocation>, ApiError> {
    req.id = id.clone();
    let location = state.store.update_ipam_location(&id, &req).await?;
    Ok(Json(location))
}

pub async fn delete_location(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_location(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ========== Datacenters ==========

pub async fn list_datacenters(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamDatacenter>>, ApiError> {
    let datacenters = state.store.list_ipam_datacenters().await?;
    Ok(Json(datacenters))
}

pub async fn get_datacenter(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<IpamDatacenter>, ApiError> {
    let datacenter = state.store.get_ipam_datacenter(&id).await?
        .ok_or_else(|| ApiError::not_found("Datacenter"))?;
    Ok(Json(datacenter))
}

pub async fn create_datacenter(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamDatacenterRequest>,
) -> Result<(StatusCode, Json<IpamDatacenter>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() || req.location_id.is_empty() {
        return Err(ApiError::bad_request("id, name, and location_id are required"));
    }
    if state.store.get_ipam_datacenter(&req.id).await?.is_some() {
        return Err(ApiError::conflict("Datacenter with this ID already exists"));
    }
    if state.store.get_ipam_location(&req.location_id).await?.is_none() {
        return Err(ApiError::bad_request("Location not found"));
    }
    let datacenter = state.store.create_ipam_datacenter(&req).await?;
    Ok(created(datacenter))
}

pub async fn update_datacenter(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateIpamDatacenterRequest>,
) -> Result<Json<IpamDatacenter>, ApiError> {
    req.id = id.clone();
    let datacenter = state.store.update_ipam_datacenter(&id, &req).await?;
    Ok(Json(datacenter))
}

pub async fn delete_datacenter(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_datacenter(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ========== Roles ==========

pub async fn list_roles(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamRole>>, ApiError> {
    let roles = state.store.list_ipam_roles().await?;
    Ok(Json(roles))
}

pub async fn create_role(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamRoleRequest>,
) -> Result<(StatusCode, Json<IpamRole>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() {
        return Err(ApiError::bad_request("id and name are required"));
    }
    let role = state.store.create_ipam_role(&req).await?;
    Ok(created(role))
}

pub async fn delete_role(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_role(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ========== Prefixes ==========

pub async fn list_prefixes(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamPrefix>>, ApiError> {
    let prefixes = state.store.list_ipam_prefixes().await?;
    Ok(Json(prefixes))
}

pub async fn list_supernets(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamPrefix>>, ApiError> {
    let prefixes = state.store.list_ipam_supernets().await?;
    Ok(Json(prefixes))
}

pub async fn get_prefix(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<IpamPrefix>, ApiError> {
    let prefix = state.store.get_ipam_prefix(id).await?
        .ok_or_else(|| ApiError::not_found("Prefix"))?;
    Ok(Json(prefix))
}

pub async fn create_prefix(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamPrefixRequest>,
) -> Result<(StatusCode, Json<IpamPrefix>), ApiError> {
    if req.prefix.is_empty() {
        return Err(ApiError::bad_request("prefix is required"));
    }
    let prefix = state.store.create_ipam_prefix(&req).await?;
    Ok(created(prefix))
}

pub async fn update_prefix(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateIpamPrefixRequest>,
) -> Result<Json<IpamPrefix>, ApiError> {
    let prefix = state.store.update_ipam_prefix(id, &req).await?;
    Ok(Json(prefix))
}

pub async fn delete_prefix(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_prefix(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn next_available_prefix(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<NextAvailablePrefixRequest>,
) -> Result<(StatusCode, Json<IpamPrefix>), ApiError> {
    if req.prefix_length < 1 || req.prefix_length > 32 {
        return Err(ApiError::bad_request("prefix_length must be between 1 and 32"));
    }
    let prefix = state.store.next_available_ipam_prefix(id, &req).await?;
    Ok(created(prefix))
}

pub async fn next_available_ip(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<NextAvailableIpRequest>,
) -> Result<(StatusCode, Json<IpamIpAddress>), ApiError> {
    let ip = state.store.next_available_ipam_ip(id, &req).await?;
    Ok(created(ip))
}

// ========== IP Addresses ==========

pub async fn list_ip_addresses(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamIpAddress>>, ApiError> {
    let ips = state.store.list_ipam_ip_addresses().await?;
    Ok(Json(ips))
}

pub async fn get_ip_address(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<IpamIpAddress>, ApiError> {
    let ip = state.store.get_ipam_ip_address(&id).await?
        .ok_or_else(|| ApiError::not_found("IP Address"))?;
    Ok(Json(ip))
}

pub async fn create_ip_address(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamIpAddressRequest>,
) -> Result<(StatusCode, Json<IpamIpAddress>), ApiError> {
    if req.id.is_empty() || req.address.is_empty() || req.prefix_id == 0 {
        return Err(ApiError::bad_request("id, address, and prefix_id are required"));
    }
    let ip = state.store.create_ipam_ip_address(&req).await?;
    Ok(created(ip))
}

pub async fn update_ip_address(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateIpamIpAddressRequest>,
) -> Result<Json<IpamIpAddress>, ApiError> {
    req.id = id.clone();
    let ip = state.store.update_ipam_ip_address(&id, &req).await?;
    Ok(Json(ip))
}

pub async fn delete_ip_address(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_ip_address(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ========== Tags ==========

pub async fn list_tags(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((resource_type, resource_id)): Path<(String, String)>,
) -> Result<Json<Vec<IpamTag>>, ApiError> {
    let tags = state.store.list_ipam_tags(&resource_type, &resource_id).await?;
    Ok(Json(tags))
}

pub async fn set_tag(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((resource_type, resource_id)): Path<(String, String)>,
    Json(req): Json<SetIpamTagRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if req.key.is_empty() {
        return Err(ApiError::bad_request("key is required"));
    }
    state.store.set_ipam_tag(&resource_type, &resource_id, &req.key, &req.value).await?;
    Ok(Json(serde_json::json!({"message": "tag set"})))
}

pub async fn delete_tag(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((resource_type, resource_id, key)): Path<(String, String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.delete_ipam_tag(&resource_type, &resource_id, &key).await?;
    Ok(Json(serde_json::json!({"message": "tag deleted"})))
}

pub async fn list_tag_keys(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<String>>, ApiError> {
    let keys = state.store.list_ipam_tag_keys().await?;
    Ok(Json(keys))
}

// ========== VRFs ==========

pub async fn list_vrfs(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<IpamVrf>>, ApiError> {
    let vrfs = state.store.list_ipam_vrfs().await?;
    Ok(Json(vrfs))
}

pub async fn create_vrf(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateIpamVrfRequest>,
) -> Result<(StatusCode, Json<IpamVrf>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() {
        return Err(ApiError::bad_request("id and name are required"));
    }
    let vrf = state.store.create_ipam_vrf(&req).await?;
    Ok(created(vrf))
}

pub async fn delete_vrf(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_ipam_vrf(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}