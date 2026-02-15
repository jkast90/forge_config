pub mod auth;
pub mod benchmarks;
pub mod credentials;
pub mod device_models;
pub mod device_roles;
pub mod devices;
pub mod device_variables;
pub mod groups;
pub mod ipam;
pub mod job_templates;
pub mod jobs;
pub mod settings;
pub mod vendors;
pub mod templates;
pub mod dhcp_options;
pub mod backups;
pub mod discovery;
pub mod configs;
pub mod docker;
pub mod netbox;
pub mod port_assignments;
pub mod output_parsers;
pub mod topologies;
pub mod users;

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};

/// Shared pagination query parameters for list endpoints.
/// Defaults: limit=100, offset=0. Max limit=1000.
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default = "default_page_limit")]
    pub limit: i32,
    #[serde(default)]
    pub offset: i32,
}

impl PaginationQuery {
    /// Clamp limit to [1, 1000] and offset to >= 0
    pub fn sanitize(&self) -> (i32, i32) {
        let limit = self.limit.clamp(1, 1000);
        let offset = self.offset.max(0);
        (limit, offset)
    }
}

fn default_page_limit() -> i32 {
    100
}

/// Error response - matches Go's {"error": "message"} format
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

impl ErrorResponse {
    pub fn new(error: impl Into<String>) -> Self {
        Self {
            error: error.into(),
        }
    }
}

/// API error type
pub struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: msg.into(),
        }
    }

    pub fn not_found(resource: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: format!("{} not found", resource),
        }
    }

    pub fn conflict(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::CONFLICT,
            message: msg.into(),
        }
    }

    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message: msg.into(),
        }
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: msg.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorResponse::new(self.message)),
        )
            .into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(err: anyhow::Error) -> Self {
        // Check for typed NotFoundError first (no fragile string matching)
        if let Some(nf) = err.downcast_ref::<crate::db::NotFoundError>() {
            return Self::not_found(&nf.to_string());
        }
        Self::internal(err.to_string())
    }
}

/// Message response for simple status messages
#[derive(Serialize)]
pub struct MessageResponse {
    pub message: String,
}

impl MessageResponse {
    pub fn new(msg: impl Into<String>) -> Json<Self> {
        Json(Self { message: msg.into() })
    }
}

/// Response helper: return 201 Created with JSON body
pub fn created<T: Serialize>(item: T) -> (StatusCode, Json<T>) {
    (StatusCode::CREATED, Json(item))
}

/// Healthcheck endpoint — returns 200 OK with status
pub async fn healthcheck() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "forge-config",
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Helper to trigger config reload with error logging
pub async fn trigger_reload(state: &std::sync::Arc<crate::AppState>) {
    if let Err(e) = state.trigger_config_reload().await {
        tracing::warn!("Failed to reload config: {}", e);
    }
}
