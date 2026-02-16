use axum::{
    extract::{Path, Query, State},
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

/// List all topologies (with device count stats)
pub async fn list_topologies(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Topology>>, ApiError> {
    let topologies = state.store.list_topologies().await?;
    Ok(Json(topologies))
}

/// Get a single topology by ID
pub async fn get_topology(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Topology>, ApiError> {
    let topology = state
        .store
        .get_topology(id)
        .await?
        .ok_or_else(|| ApiError::not_found("topology"))?;
    Ok(Json(topology))
}

/// Create a new topology
pub async fn create_topology(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTopologyRequest>,
) -> Result<(axum::http::StatusCode, Json<Topology>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let topology = state.store.create_topology(&req).await?;
    Ok(created(topology))
}

/// Update an existing topology
pub async fn update_topology(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateTopologyRequest>,
) -> Result<Json<Topology>, ApiError> {
    let topology = state.store.update_topology(id, &req).await?;
    Ok(Json(topology))
}

/// Delete a topology. Pass ?delete_devices=true to also delete all devices in the topology.
pub async fn delete_topology(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<axum::http::StatusCode, ApiError> {
    if params.get("delete_devices").map(|v| v == "true").unwrap_or(false) {
        state.store.delete_devices_by_topology(id).await?;
    }
    state.store.delete_topology(id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
