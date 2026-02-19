use std::sync::Arc;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use crate::{auth::AuthUser, handlers::ApiError, AppState};

#[derive(Deserialize)]
pub struct BroadcastRequest {
    #[serde(rename = "type")]
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Serialize)]
pub struct BroadcastResponse {
    pub clients: usize,
}

pub async fn broadcast(
    _auth: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<BroadcastRequest>,
) -> Result<Json<BroadcastResponse>, ApiError> {
    if req.event_type.trim().is_empty() {
        return Err(ApiError::bad_request("type is required"));
    }
    let data = serde_json::json!({
        "type": req.event_type,
        "payload": req.payload,
    });
    let clients = if let Some(hub) = &state.ws_hub {
        hub.broadcast_json(data).await
    } else {
        0
    };
    Ok(Json(BroadcastResponse { clients }))
}
