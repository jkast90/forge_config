use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::db::get_default_dhcp_options_models;
use crate::models::*;
use crate::AppState;

use super::{created, trigger_reload, ApiError};

/// List all DHCP options
pub async fn list_dhcp_options(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DhcpOption>>, ApiError> {
    let options = state.store.list_dhcp_options().await?;
    Ok(Json(options))
}

/// Get default DHCP options
pub async fn get_default_dhcp_options(
    _auth: crate::auth::AuthUser,
) -> Result<Json<Vec<DhcpOption>>, ApiError> {
    let options = get_default_dhcp_options_models();
    Ok(Json(options))
}

/// Get a single DHCP option by ID
pub async fn get_dhcp_option(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<DhcpOption>, ApiError> {
    let option = state
        .store
        .get_dhcp_option(id)
        .await?
        .ok_or_else(|| ApiError::not_found("dhcp option"))?;
    Ok(Json(option))
}

/// Create a new DHCP option
pub async fn create_dhcp_option(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateDhcpOptionRequest>,
) -> Result<(axum::http::StatusCode, Json<DhcpOption>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let option = state.store.create_dhcp_option(&req).await?;
    trigger_reload(&state).await;
    Ok(created(option))
}

/// Update an existing DHCP option
pub async fn update_dhcp_option(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateDhcpOptionRequest>,
) -> Result<Json<DhcpOption>, ApiError> {
    let option = state.store.update_dhcp_option(id, &req).await?;
    trigger_reload(&state).await;
    Ok(Json(option))
}

/// Delete a DHCP option
pub async fn delete_dhcp_option(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_dhcp_option(id).await?;
    trigger_reload(&state).await;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
