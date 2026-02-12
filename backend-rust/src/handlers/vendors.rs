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
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Vendor>>, ApiError> {
    let vendors = state.store.list_vendors().await?;
    Ok(Json(vendors))
}

/// Get default vendors
pub async fn get_default_vendors() -> Result<Json<Vec<Vendor>>, ApiError> {
    let vendors = get_default_vendors_models();
    Ok(Json(vendors))
}

/// Get a single vendor by ID
pub async fn get_vendor(
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
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_vendor(&id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
