use axum::{
    extract::{Path, State},
    http::StatusCode,
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
    Path(id): Path<i64>,
) -> Result<Json<Vendor>, ApiError> {
    let vendor = state
        .store
        .get_vendor(id)
        .await?
        .ok_or_else(|| ApiError::not_found("vendor"))?;
    Ok(Json(vendor))
}

/// Get a vendor by name (case-insensitive)
pub async fn get_vendor_by_name(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> Result<Json<Vendor>, ApiError> {
    let vendor = state
        .store
        .get_vendor_by_name(&name)
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
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let vendor = state.store.create_vendor(&req).await?;
    Ok(created(vendor))
}

/// Update an existing vendor
pub async fn update_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateVendorRequest>,
) -> Result<Json<Vendor>, ApiError> {
    let vendor = state.store.update_vendor(id, &req).await?;
    Ok(Json(vendor))
}

/// Delete a vendor
pub async fn delete_vendor(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_vendor(id).await?;
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
    Path(id): Path<i64>,
) -> Result<Json<Vec<VendorAction>>, ApiError> {
    let actions = state.store.list_vendor_actions_by_vendor(id).await?;
    Ok(Json(actions))
}

/// Create a vendor action
pub async fn create_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateVendorActionRequest>,
) -> Result<(axum::http::StatusCode, Json<VendorAction>), ApiError> {
    if req.vendor_id == 0 || req.label.is_empty() {
        return Err(ApiError::bad_request("vendor_id and label are required"));
    }
    if req.action_type == "webhook" {
        if req.webhook_url.is_empty() {
            return Err(ApiError::bad_request("webhook_url is required for webhook actions"));
        }
    } else if req.command.is_empty() {
        return Err(ApiError::bad_request("command is required for SSH actions"));
    }
    let action = state.store.create_vendor_action(&req).await?;
    Ok(created(action))
}

/// Update a vendor action
pub async fn update_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateVendorActionRequest>,
) -> Result<Json<VendorAction>, ApiError> {
    let action = state.store.update_vendor_action(id, &req).await?;
    Ok(Json(action))
}

/// Delete a vendor action
pub async fn delete_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_vendor_action(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Run a webhook action without a specific device target
pub async fn run_vendor_action(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<(StatusCode, Json<Job>), ApiError> {
    let action = state.store.get_vendor_action(id).await
        .map_err(|e| ApiError::internal(e.to_string()))?
        .ok_or_else(|| ApiError::not_found("vendor action"))?;

    if action.action_type != "webhook" {
        return Err(ApiError::bad_request("only webhook actions can run without a device"));
    }

    let job_id = uuid::Uuid::new_v4().to_string();
    let req = CreateJobRequest {
        device_id: 0,
        job_type: job_type::WEBHOOK.to_string(),
        command: action.id.to_string(),
        credential_id: String::new(),
        triggered_by: "manual".to_string(),
    };

    let job = state.store.create_job(&job_id, &req).await
        .map_err(|e| ApiError::internal(e.to_string()))?;

    if let Some(ref hub) = state.ws_hub {
        hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
    }

    if let Some(ref job_service) = state.job_service {
        job_service.submit(job_id).await;
    }

    Ok((StatusCode::ACCEPTED, Json(job)))
}
