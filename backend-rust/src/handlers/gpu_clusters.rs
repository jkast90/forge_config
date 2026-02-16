use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

/// List all GPU clusters
pub async fn list_gpu_clusters(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<GpuCluster>>, ApiError> {
    let clusters = state.store.list_gpu_clusters().await?;
    Ok(Json(clusters))
}

/// Get a single GPU cluster by ID
pub async fn get_gpu_cluster(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<GpuCluster>, ApiError> {
    let cluster = state
        .store
        .get_gpu_cluster(id)
        .await?
        .ok_or_else(|| ApiError::not_found("GPU cluster"))?;
    Ok(Json(cluster))
}

/// Create a new GPU cluster
pub async fn create_gpu_cluster(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateGpuClusterRequest>,
) -> Result<(axum::http::StatusCode, Json<GpuCluster>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let cluster = state.store.create_gpu_cluster(&req).await?;
    Ok(created(cluster))
}

/// Update an existing GPU cluster
pub async fn update_gpu_cluster(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateGpuClusterRequest>,
) -> Result<Json<GpuCluster>, ApiError> {
    let cluster = state.store.update_gpu_cluster(id, &req).await?;
    Ok(Json(cluster))
}

/// Delete a GPU cluster
pub async fn delete_gpu_cluster(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_gpu_cluster(id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
