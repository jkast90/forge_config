use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::AppState;

use super::ApiError;

/// List backups for a device
pub async fn list_backups(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<crate::models::Backup>>, ApiError> {
    // Verify device exists
    state
        .store
        .get_device(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    let backups = state.store.list_backups(&id).await?;
    Ok(Json(backups))
}

/// Get a single backup by ID
pub async fn get_backup(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<BackupWithContent>, ApiError> {
    let backup = state
        .store
        .get_backup(id)
        .await?
        .ok_or_else(|| ApiError::not_found("backup"))?;

    // Read backup content from file
    let backup_path = std::path::Path::new(&state.config.backup_dir).join(&backup.filename);
    let content = match tokio::fs::read_to_string(&backup_path).await {
        Ok(content) => Some(content),
        Err(_) => None,
    };

    Ok(Json(BackupWithContent {
        id: backup.id,
        device_id: backup.device_id,
        filename: backup.filename,
        size: backup.size,
        created_at: backup.created_at,
        exists: content.is_some(),
        content,
    }))
}

/// Trigger a manual backup for a device
/// Returns 202 Accepted since backup runs asynchronously
pub async fn trigger_backup(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<(StatusCode, Json<serde_json::Value>), ApiError> {
    // Verify device exists
    let _device = state
        .store
        .get_device(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Queue backup via backup service
    if let Some(backup_svc) = &state.backup_service {
        backup_svc.trigger_backup(id.clone()).await;
    }

    Ok((StatusCode::ACCEPTED, Json(serde_json::json!({
        "message": "backup initiated"
    }))))
}

/// Backup response with content
#[derive(serde::Serialize)]
pub struct BackupWithContent {
    pub id: i64,
    pub device_id: String,
    pub filename: String,
    pub size: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub exists: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}
