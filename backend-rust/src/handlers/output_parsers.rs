use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use crate::{models::*, handlers::ApiError, AppState};

use super::created;

pub async fn list_output_parsers(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<OutputParser>>, ApiError> {
    let parsers = state.store.list_output_parsers().await?;
    Ok(Json(parsers))
}

pub async fn get_output_parser(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<OutputParser>, ApiError> {
    let parser = state.store.get_output_parser(id).await?
        .ok_or_else(|| ApiError::not_found("OutputParser"))?;
    Ok(Json(parser))
}

pub async fn create_output_parser(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateOutputParserRequest>,
) -> Result<(StatusCode, Json<OutputParser>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }
    let parser = state.store.create_output_parser(&req).await?;
    Ok(created(parser))
}

pub async fn update_output_parser(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<CreateOutputParserRequest>,
) -> Result<Json<OutputParser>, ApiError> {
    let parser = state.store.update_output_parser(id, &req).await?;
    Ok(Json(parser))
}

pub async fn delete_output_parser(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_output_parser(id).await?;
    Ok(StatusCode::NO_CONTENT)
}
