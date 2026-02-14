use axum::{
    extract::{Path, State},
    http::header,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

use crate::utils::normalize_mac;
use crate::AppState;

/// Serve a device configuration file (HTTP config server)
pub async fn serve_config(
    State(state): State<Arc<AppState>>,
    Path(filename): Path<String>,
) -> Response {
    // Security: prevent path traversal
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid filename",
        )
            .into_response();
    }

    let config_path = std::path::Path::new(&state.config.tftp_dir).join(&filename);

    match tokio::fs::read_to_string(&config_path).await {
        Ok(content) => {
            // Try to extract MAC from filename and broadcast config_pulled event
            if filename.ends_with(".cfg") {
                let mac_part = filename.trim_end_matches(".cfg").replace('_', ":");
                let mac = normalize_mac(&mac_part);

                // Get device info if available
                if let Ok(Some(device)) = state.store.get_device_by_mac(&mac).await {
                    // Broadcast config pulled event via WebSocket
                    if let Some(ws_hub) = &state.ws_hub {
                        ws_hub
                            .broadcast_config_pulled(
                                &mac,
                                &device.ip,
                                &device.hostname,
                                &filename,
                                "http",
                            )
                            .await;
                    }
                }
            }

            (
                [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
                content,
            )
                .into_response()
        }
        Err(_) => (axum::http::StatusCode::NOT_FOUND, "Config not found").into_response(),
    }
}
