use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{auth::AuthUser, models::*, handlers::{ApiError, created}, AppState};

pub async fn list_users(
    _auth: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<User>>, ApiError> {
    let users = state.store.list_users().await?;
    Ok(Json(users))
}

pub async fn get_user(
    _auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<User>, ApiError> {
    let user = state.store.get_user(id).await?
        .ok_or_else(|| ApiError::not_found("User"))?;
    Ok(Json(user))
}

pub async fn create_user(
    _auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateUserRequest>,
) -> Result<(StatusCode, Json<User>), ApiError> {
    if req.username.is_empty() || req.password.is_empty() {
        return Err(ApiError::bad_request("username and password are required"));
    }
    if state.store.get_user_by_username(&req.username).await?.is_some() {
        return Err(ApiError::conflict("A user with this username already exists"));
    }
    let user = state.store.create_user_full(&req).await?;
    Ok(created(user))
}

pub async fn update_user(
    _auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateUserRequest>,
) -> Result<Json<User>, ApiError> {
    if req.username.is_empty() {
        return Err(ApiError::bad_request("username is required"));
    }
    // Check for username uniqueness (excluding self)
    if let Some(existing) = state.store.get_user_by_username(&req.username).await? {
        if existing.id != id {
            return Err(ApiError::conflict("A user with this username already exists"));
        }
    }
    let user = state.store.update_user(id, &req).await?;
    Ok(Json(user))
}

pub async fn delete_user(
    auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    // Prevent self-deletion
    if auth.claims.sub == id.to_string() {
        return Err(ApiError::bad_request("Cannot delete your own account"));
    }
    state.store.delete_user(id).await?;
    Ok(StatusCode::NO_CONTENT)
}
