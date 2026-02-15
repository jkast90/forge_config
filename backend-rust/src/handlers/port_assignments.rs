use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::ApiError;

/// List all port assignments for a device.
/// Also includes assignments that reference this device as a patch panel.
pub async fn list_port_assignments(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Vec<PortAssignment>>, ApiError> {
    let mut assignments = state.store.list_port_assignments(id).await?;
    // Also include assignments routed through this device as a patch panel
    let pp_assignments = state.store.list_port_assignments_for_patch_panel(id).await?;
    let existing_ids: std::collections::HashSet<i64> = assignments.iter().map(|a| a.id).collect();
    for pa in pp_assignments {
        if !existing_ids.contains(&pa.id) {
            assignments.push(pa);
        }
    }
    Ok(Json(assignments))
}

/// Bulk-set all port assignments for a device (replaces existing)
pub async fn bulk_set_port_assignments(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<BulkPortAssignmentRequest>,
) -> Result<Json<Vec<PortAssignment>>, ApiError> {
    let assignments = state
        .store
        .bulk_set_port_assignments(id, &req.assignments)
        .await?;
    Ok(Json(assignments))
}

/// Set a single port assignment
pub async fn set_port_assignment(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, port_name)): Path<(i64, String)>,
    Json(mut req): Json<SetPortAssignmentRequest>,
) -> Result<Json<PortAssignment>, ApiError> {
    req.port_name = port_name;
    let assignment = state.store.set_port_assignment(id, &req).await?;
    Ok(Json(assignment))
}

/// Delete a single port assignment
pub async fn delete_port_assignment(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path((id, port_name)): Path<(i64, String)>,
) -> Result<StatusCode, ApiError> {
    state.store.delete_port_assignment(id, &port_name).await?;
    Ok(StatusCode::NO_CONTENT)
}
