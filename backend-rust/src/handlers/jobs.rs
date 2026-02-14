use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use super::ApiError;
use crate::models::Job;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct JobsQuery {
    #[serde(default)]
    pub device_id: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

fn default_limit() -> i32 {
    50
}

/// GET /api/jobs/:id — get a single job
pub async fn get_job(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Job>, ApiError> {
    let job = state
        .store
        .get_job(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("job"))?;
    Ok(Json(job))
}

/// GET /api/jobs — list jobs, optionally filtered by device_id
pub async fn list_jobs(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Query(query): Query<JobsQuery>,
) -> Result<Json<Vec<Job>>, ApiError> {
    let limit = query.limit.clamp(1, 200);
    let jobs = if let Some(device_id) = &query.device_id {
        state.store.list_jobs_by_device(device_id, limit).await?
    } else {
        state.store.list_jobs_recent(limit).await?
    };
    Ok(Json(jobs))
}
