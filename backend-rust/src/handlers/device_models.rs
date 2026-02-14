use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

/// List all device models
pub async fn list_device_models(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DeviceModel>>, ApiError> {
    let models = state.store.list_device_models().await?;
    Ok(Json(models))
}

/// Get a single device model by ID
pub async fn get_device_model(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<DeviceModel>, ApiError> {
    let model = state
        .store
        .get_device_model(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("device model"))?;
    Ok(Json(model))
}

/// Create a new device model
pub async fn create_device_model(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateDeviceModelRequest>,
) -> Result<(axum::http::StatusCode, Json<DeviceModel>), ApiError> {
    if req.id.is_empty() || req.vendor_id.is_empty() || req.model.is_empty() || req.display_name.is_empty() {
        return Err(ApiError::bad_request("id, vendor_id, model, and display_name are required"));
    }

    // Check for duplicate
    if state.store.get_device_model(&req.id).await?.is_some() {
        return Err(ApiError::conflict("device model with this ID already exists"));
    }

    let model = state.store.create_device_model(&req).await?;
    Ok(created(model))
}

/// Update an existing device model
pub async fn update_device_model(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateDeviceModelRequest>,
) -> Result<Json<DeviceModel>, ApiError> {
    req.id = id.clone();
    let model = state.store.update_device_model(&id, &req).await?;
    Ok(Json(model))
}

/// Delete a device model
pub async fn delete_device_model(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_device_model(&id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
