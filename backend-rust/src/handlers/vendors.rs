use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::db::get_default_vendors_models;
use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

/// List all vendors
pub async fn list_vendors(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Vendor>>, ApiError> {
    let vendors = state.store.list_vendors().await?;
    Ok(Json(vendors))
}

/// Get default vendors
pub async fn get_default_vendors(
    _auth: crate::auth::AuthUser,
) -> Result<Json<Vec<Vendor>>, ApiError> {
    let vendors = get_default_vendors_models();
    Ok(Json(vendors))
}

/// Get a single vendor by ID
pub async fn get_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vendor>, ApiError> {
    let vendor = state
        .store
        .get_vendor(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("vendor"))?;
    Ok(Json(vendor))
}

/// Create a new vendor
pub async fn create_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateVendorRequest>,
) -> Result<(axum::http::StatusCode, Json<Vendor>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() {
        return Err(ApiError::bad_request("id and name are required"));
    }

    // Check for duplicate
    if state.store.get_vendor(&req.id).await?.is_some() {
        return Err(ApiError::conflict("vendor with this ID already exists"));
    }

    let vendor = state.store.create_vendor(&req).await?;
    Ok(created(vendor))
}

/// Update an existing vendor
pub async fn update_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateVendorRequest>,
) -> Result<Json<Vendor>, ApiError> {
    req.id = id.clone();
    let vendor = state.store.update_vendor(&id, &req).await?;
    Ok(Json(vendor))
}

/// Delete a vendor
pub async fn delete_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_vendor(&id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ========== Vendor Action Endpoints ==========

/// List all vendor actions
pub async fn list_vendor_actions(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<VendorAction>>, ApiError> {
    let actions = state.store.list_vendor_actions().await?;
    Ok(Json(actions))
}

/// List actions for a specific vendor
pub async fn list_vendor_actions_by_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<VendorAction>>, ApiError> {
    let actions = state.store.list_vendor_actions_by_vendor(&id).await?;
    Ok(Json(actions))
}

/// Create a vendor action
pub async fn create_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateVendorActionRequest>,
) -> Result<(axum::http::StatusCode, Json<VendorAction>), ApiError> {
    if req.id.is_empty() || req.vendor_id.is_empty() || req.label.is_empty() || req.command.is_empty() {
        return Err(ApiError::bad_request("id, vendor_id, label, and command are required"));
    }
    let action = state.store.create_vendor_action(&req).await?;
    Ok(created(action))
}

/// Update a vendor action
pub async fn update_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateVendorActionRequest>,
) -> Result<Json<VendorAction>, ApiError> {
    req.id = id.clone();
    let action = state.store.update_vendor_action(&id, &req).await?;
    Ok(Json(action))
}

/// Delete a vendor action
pub async fn delete_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_vendor_action(&id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
