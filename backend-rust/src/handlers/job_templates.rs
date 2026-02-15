use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{created, ApiError};

/// List all job templates
pub async fn list_job_templates(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<JobTemplate>>, ApiError> {
    let templates = state.store.list_job_templates().await?;
    Ok(Json(templates))
}

/// Get a single job template by ID
pub async fn get_job_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<JobTemplate>, ApiError> {
    let template = state
        .store
        .get_job_template(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("job template"))?;
    Ok(Json(template))
}

/// Create a new job template
pub async fn create_job_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateJobTemplateRequest>,
) -> Result<(StatusCode, Json<JobTemplate>), ApiError> {
    if req.name.is_empty() {
        return Err(ApiError::bad_request("name is required"));
    }
    let template = state.store.create_job_template(&req).await?;
    Ok(created(template))
}

/// Update an existing job template
pub async fn update_job_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<CreateJobTemplateRequest>,
) -> Result<Json<JobTemplate>, ApiError> {
    let template = state.store.update_job_template(&id, &req).await?;
    Ok(Json(template))
}

/// Delete a job template
pub async fn delete_job_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_job_template(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Run a job template immediately — creates jobs for each target device
pub async fn run_job_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Job>>, ApiError> {
    let template = state
        .store
        .get_job_template(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("job template"))?;

    // Resolve target device IDs
    let device_ids: Vec<i64> = if template.target_mode == "group" && !template.target_group_id.is_empty() {
        state.store.list_group_members(&template.target_group_id).await
            .map_err(|e| ApiError::internal(e.to_string()))?
    } else {
        template.target_device_ids.clone()
    };

    // For webhook actions with no device targets (static webhooks), run once
    let is_webhook = template.job_type == job_type::WEBHOOK;
    let is_static_webhook = is_webhook && device_ids.is_empty();

    let mut jobs = Vec::new();

    if is_static_webhook {
        // Static webhook — run without device
        let job_id = uuid::Uuid::new_v4().to_string();
        let req = CreateJobRequest {
            device_id: 0,
            job_type: template.job_type.clone(),
            command: template.action_id.clone(),
            credential_id: template.credential_id.clone(),
        };
        let job = state.store.create_job(&job_id, &req).await
            .map_err(|e| ApiError::internal(e.to_string()))?;

        if let Some(ref hub) = state.ws_hub {
            hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
        }
        if let Some(ref job_service) = state.job_service {
            job_service.submit(job_id).await;
        }
        jobs.push(job);
    } else {
        // Create a job for each target device
        for device_id in &device_ids {
            let job_id = uuid::Uuid::new_v4().to_string();
            let command = if is_webhook {
                template.action_id.clone()
            } else if !template.action_id.is_empty() {
                // SSH action — resolve the action's command
                match state.store.get_vendor_action(&template.action_id).await {
                    Ok(Some(action)) => action.command.clone(),
                    _ => template.command.clone(),
                }
            } else {
                template.command.clone()
            };

            let jt = if is_webhook {
                job_type::WEBHOOK.to_string()
            } else {
                template.job_type.clone()
            };

            let req = CreateJobRequest {
                device_id: *device_id,
                job_type: jt,
                command,
                credential_id: template.credential_id.clone(),
            };

            match state.store.create_job(&job_id, &req).await {
                Ok(job) => {
                    if let Some(ref hub) = state.ws_hub {
                        hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
                    }
                    if let Some(ref job_service) = state.job_service {
                        job_service.submit(job_id).await;
                    }
                    jobs.push(job);
                }
                Err(e) => {
                    tracing::warn!("Failed to create job for device {}: {}", device_id, e);
                }
            }
        }
    }

    // Update last_run_at
    let _ = state.store.update_job_template_last_run(&id).await;

    Ok(Json(jobs))
}
