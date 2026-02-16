use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

pub async fn list_tenants(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Tenant>>, ApiError> {
    let tenants = state.store.list_tenants().await?;
    Ok(Json(tenants))
}

pub async fn get_tenant(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Tenant>, ApiError> {
    let tenant = state
        .store
        .get_tenant(id)
        .await?
        .ok_or_else(|| ApiError::not_found("Tenant"))?;
    Ok(Json(tenant))
}

pub async fn create_tenant(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTenantRequest>,
) -> Result<(axum::http::StatusCode, Json<Tenant>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }

    let tenant = state.store.create_tenant(&req).await?;
    Ok(created(tenant))
}

pub async fn update_tenant(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateTenantRequest>,
) -> Result<Json<Tenant>, ApiError> {
    let tenant = state.store.update_tenant(id, &req).await?;
    Ok(Json(tenant))
}

pub async fn delete_tenant(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_tenant(id).await?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
