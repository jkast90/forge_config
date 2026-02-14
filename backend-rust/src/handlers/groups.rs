use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::models::{CreateGroupRequest, Group, GroupVariable, ResolvedVariablesResponse};
use crate::AppState;

use super::{ApiError, created};

// ========== Group CRUD ==========

pub async fn list_groups(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Group>>, ApiError> {
    let groups = state.store.list_groups().await?;
    Ok(Json(groups))
}

pub async fn get_group(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Group>, ApiError> {
    let group = state.store.get_group(&id).await?
        .ok_or_else(|| ApiError::not_found("Group"))?;
    Ok(Json(group))
}

pub async fn create_group(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateGroupRequest>,
) -> Result<(axum::http::StatusCode, Json<Group>), ApiError> {
    // Reject creating a group with id "all"
    if req.id == "all" {
        return Err(ApiError::bad_request("Cannot create a group with id 'all' — it is reserved"));
    }

    // Validate parent wouldn't create a cycle
    if let Some(ref parent_id) = req.parent_id {
        if state.store.would_create_cycle(&req.id, parent_id).await? {
            return Err(ApiError::bad_request("Setting this parent would create a cycle"));
        }
    }

    let group = state.store.create_group(&req).await?;
    Ok(created(group))
}

pub async fn update_group(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<CreateGroupRequest>,
) -> Result<Json<Group>, ApiError> {
    // Protect "all" group invariants
    if id == "all" {
        if req.parent_id.is_some() {
            return Err(ApiError::bad_request("Cannot set parent_id on the 'all' group"));
        }
        if req.precedence != 0 {
            return Err(ApiError::bad_request("Cannot change precedence of the 'all' group"));
        }
    }

    // Validate parent wouldn't create a cycle
    if let Some(ref parent_id) = req.parent_id {
        if state.store.would_create_cycle(&id, parent_id).await? {
            return Err(ApiError::bad_request("Setting this parent would create a cycle"));
        }
    }

    let group = state.store.update_group(&id, &req).await?;
    Ok(Json(group))
}

pub async fn delete_group(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.delete_group(&id).await?;
    Ok(Json(serde_json::json!({"message": "group deleted"})))
}

// ========== Group Variables ==========

pub async fn list_group_variables(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<GroupVariable>>, ApiError> {
    let vars = state.store.list_group_variables(&id).await?;
    Ok(Json(vars))
}

#[derive(Deserialize)]
pub struct SetVariableRequest {
    pub value: String,
}

pub async fn set_group_variable(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, key)): Path<(String, String)>,
    Json(req): Json<SetVariableRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.set_group_variable(&id, &key, &req.value).await?;
    Ok(Json(serde_json::json!({"message": "variable set"})))
}

pub async fn delete_group_variable(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, key)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.delete_group_variable(&id, &key).await?;
    Ok(Json(serde_json::json!({"message": "variable deleted"})))
}

// ========== Group Membership ==========

pub async fn list_group_members(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<String>>, ApiError> {
    let members = state.store.list_group_members(&id).await?;
    Ok(Json(members))
}

#[derive(Deserialize)]
pub struct SetMembersRequest {
    pub device_ids: Vec<String>,
}

pub async fn set_group_members(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<SetMembersRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.set_group_members(&id, &req.device_ids).await?;
    Ok(Json(serde_json::json!({"message": "members updated"})))
}

pub async fn add_group_member(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, device_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.add_device_to_group(&device_id, &id).await?;
    Ok(Json(serde_json::json!({"message": "device added to group"})))
}

pub async fn remove_group_member(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, device_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.remove_device_from_group(&device_id, &id).await?;
    Ok(Json(serde_json::json!({"message": "device removed from group"})))
}

// ========== Device Groups ==========

pub async fn list_device_groups(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Group>>, ApiError> {
    let groups = state.store.list_device_groups(&id).await?;
    Ok(Json(groups))
}

#[derive(Deserialize)]
pub struct SetDeviceGroupsRequest {
    pub group_ids: Vec<String>,
}

pub async fn set_device_groups(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<SetDeviceGroupsRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.store.set_device_groups(&id, &req.group_ids).await?;
    Ok(Json(serde_json::json!({"message": "device groups updated"})))
}

// ========== Resolved Variables (Inspector) ==========

pub async fn get_resolved_variables(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ResolvedVariablesResponse>, ApiError> {
    let result = state.store.resolve_device_variables(&id).await?;
    Ok(Json(result))
}
