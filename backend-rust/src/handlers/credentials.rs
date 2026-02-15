use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{models::*, handlers::ApiError, AppState};

fn created<T: serde::Serialize>(item: T) -> (StatusCode, Json<T>) {
    (StatusCode::CREATED, Json(item))
}

pub async fn list_credentials(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Credential>>, ApiError> {
    let credentials = state.store.list_credentials().await?;
    Ok(Json(credentials))
}

pub async fn get_credential(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Credential>, ApiError> {
    let credential = state.store.get_credential(id).await?
        .ok_or_else(|| ApiError::not_found("Credential"))?;
    Ok(Json(credential))
}

pub async fn create_credential(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateCredentialRequest>,
) -> Result<(StatusCode, Json<Credential>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }
    let credential = state.store.create_credential(&req).await?;
    Ok(created(credential))
}

pub async fn update_credential(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateCredentialRequest>,
) -> Result<Json<Credential>, ApiError> {
    let credential = state.store.update_credential(id, &req).await?;
    Ok(Json(credential))
}

pub async fn delete_credential(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_credential(id).await?;
    Ok(StatusCode::NO_CONTENT)
}
