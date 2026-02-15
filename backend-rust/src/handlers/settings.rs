use axum::{
    body::Bytes,
    extract::State,
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Serialize;
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{trigger_reload, ApiError, MessageResponse};

/// Get the global settings
pub async fn get_settings(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Settings>, ApiError> {
    let settings = state.store.get_settings().await?;
    Ok(Json(settings))
}

/// Update the global settings
pub async fn update_settings(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(settings): Json<Settings>,
) -> Result<Json<Settings>, ApiError> {
    state.store.update_settings(&settings).await?;
    trigger_reload(&state).await;
    Ok(Json(settings))
}

/// Trigger a manual config regeneration
pub async fn reload_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    state
        .trigger_config_reload()
        .await
        .map_err(|e| ApiError::internal(format!("Failed to reload config: {}", e)))?;

    Ok(MessageResponse::new("configuration reloaded"))
}

/// Get local network interfaces and their IP addresses
pub async fn get_local_addresses(
    _auth: crate::auth::AuthUser,
) -> Result<Json<Vec<NetworkInterface>>, ApiError> {
    let interfaces = get_network_interfaces().await?;
    Ok(Json(interfaces))
}

/// Public branding info (no auth required)
#[derive(Serialize)]
pub struct BrandingResponse {
    pub app_name: String,
    pub logo_url: Option<String>,
}

pub async fn get_branding(
    State(state): State<Arc<AppState>>,
) -> Result<Json<BrandingResponse>, ApiError> {
    let settings = state.store.get_settings().await?;
    Ok(Json(BrandingResponse {
        app_name: settings.app_name.unwrap_or_else(|| "ZTP Manager".to_string()),
        logo_url: settings.logo_url.clone(),
    }))
}

/// Upload a custom logo image
pub async fn upload_logo(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> Result<Json<MessageResponse>, ApiError> {
    if body.is_empty() {
        return Err(ApiError::bad_request("No file data received"));
    }

    // Limit to 2MB
    if body.len() > 2 * 1024 * 1024 {
        return Err(ApiError::bad_request("Logo file must be under 2MB"));
    }

    // Detect image type from magic bytes
    let ext = if body.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        "png"
    } else if body.starts_with(&[0xFF, 0xD8, 0xFF]) {
        "jpg"
    } else if body.starts_with(b"GIF") {
        "gif"
    } else if body.len() >= 4 && &body[..4] == b"RIFF" && body.len() >= 12 && &body[8..12] == b"WEBP" {
        "webp"
    } else if body.starts_with(b"<svg") || body.starts_with(b"<?xml") {
        "svg"
    } else {
        return Err(ApiError::bad_request(
            "Unsupported image format. Use PNG, JPG, GIF, WebP, or SVG",
        ));
    };

    let filename = format!("custom-logo.{}", ext);
    let path = format!("/data/{}", filename);

    // Remove any old logo files
    for old_ext in &["png", "jpg", "gif", "webp", "svg"] {
        let old_path = format!("/data/custom-logo.{}", old_ext);
        let _ = tokio::fs::remove_file(&old_path).await;
    }

    tokio::fs::write(&path, &body)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to save logo: {}", e)))?;

    // Update settings with logo URL
    let mut settings = state.store.get_settings().await?;
    settings.logo_url = Some(format!("/api/branding/logo?v={}", chrono::Utc::now().timestamp()));
    state.store.update_settings(&settings).await?;

    Ok(MessageResponse::new("Logo uploaded successfully"))
}

/// Delete the custom logo
pub async fn delete_logo(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    // Remove any logo files
    for ext in &["png", "jpg", "gif", "webp", "svg"] {
        let path = format!("/data/custom-logo.{}", ext);
        let _ = tokio::fs::remove_file(&path).await;
    }

    // Clear logo URL from settings
    let mut settings = state.store.get_settings().await?;
    settings.logo_url = None;
    state.store.update_settings(&settings).await?;

    Ok(MessageResponse::new("Logo removed"))
}

/// Serve the custom logo file
pub async fn get_logo(
    State(_state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, ApiError> {
    // Try each supported extension
    for (ext, content_type) in &[
        ("png", "image/png"),
        ("jpg", "image/jpeg"),
        ("gif", "image/gif"),
        ("webp", "image/webp"),
        ("svg", "image/svg+xml"),
    ] {
        let path = format!("/data/custom-logo.{}", ext);
        if let Ok(data) = tokio::fs::read(&path).await {
            return Ok((
                StatusCode::OK,
                [(header::CONTENT_TYPE, *content_type),
                 (header::CACHE_CONTROL, "public, max-age=86400")],
                data,
            ));
        }
    }

    Err(ApiError::not_found("Logo"))
}

async fn get_network_interfaces() -> anyhow::Result<Vec<NetworkInterface>> {
    use std::collections::HashMap;

    let if_addrs = if_addrs::get_if_addrs()
        .map_err(|e| anyhow::anyhow!("Failed to enumerate network interfaces: {}", e))?;

    // Group addresses by interface name
    let mut iface_map: HashMap<String, NetworkInterface> = HashMap::new();

    for iface in &if_addrs {
        let entry = iface_map.entry(iface.name.clone()).or_insert_with(|| NetworkInterface {
            name: iface.name.clone(),
            addresses: Vec::new(),
            is_up: true, // if-addrs only returns active interfaces
            is_loopback: iface.is_loopback(),
        });

        let addr = iface.ip().to_string();
        if !entry.addresses.contains(&addr) {
            entry.addresses.push(addr);
        }
    }

    // Sort by name for consistent ordering
    let mut result: Vec<NetworkInterface> = iface_map.into_values()
        .filter(|iface| !iface.addresses.is_empty())
        .collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));

    // If running in Docker, try to resolve host.docker.internal
    if std::path::Path::new("/.dockerenv").exists() {
        if let Ok(host_addrs) = tokio::net::lookup_host("host.docker.internal:0").await {
            let host_ips: Vec<String> = host_addrs
                .filter_map(|a| {
                    let ip = a.ip();
                    if ip.is_loopback() { None } else { Some(ip.to_string()) }
                })
                .collect();
            if !host_ips.is_empty() {
                result.push(NetworkInterface {
                    name: "docker-host".to_string(),
                    addresses: host_ips,
                    is_up: true,
                    is_loopback: false,
                });
            }
        }
    }

    // Also check EXTERNAL_IP env var for user-configured addresses
    if let Ok(external) = std::env::var("EXTERNAL_IP") {
        let ext_addrs: Vec<String> = external.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !ext_addrs.is_empty() {
            result.push(NetworkInterface {
                name: "external".to_string(),
                addresses: ext_addrs,
                is_up: true,
                is_loopback: false,
            });
        }
    }

    Ok(result)
}
