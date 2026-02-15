use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{models::*, handlers::ApiError, AppState};

fn created<T: serde::Serialize>(item: T) -> (StatusCode, Json<T>) {
    (StatusCode::CREATED, Json(item))
}

pub async fn list_device_roles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DeviceRole>>, ApiError> {
    let roles = state.store.list_device_roles().await?;
    Ok(Json(roles))
}

pub async fn get_device_role(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<DeviceRole>, ApiError> {
    let role = state.store.get_device_role(&id).await?
        .ok_or_else(|| ApiError::not_found("DeviceRole"))?;
    Ok(Json(role))
}

pub async fn create_device_role(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateDeviceRoleRequest>,
) -> Result<(StatusCode, Json<DeviceRole>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() {
        return Err(ApiError::bad_request("id and name are required"));
    }
    if state.store.get_device_role(&req.id).await?.is_some() {
        return Err(ApiError::conflict("Device role with this ID already exists"));
    }
    let role = state.store.create_device_role(&req).await?;
    Ok(created(role))
}

pub async fn update_device_role(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<CreateDeviceRoleRequest>,
) -> Result<Json<DeviceRole>, ApiError> {
    let role = state.store.update_device_role(&id, &req).await?;
    Ok(Json(role))
}

pub async fn delete_device_role(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_device_role(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}
