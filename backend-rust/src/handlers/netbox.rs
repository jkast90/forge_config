use axum::{
    extract::State,
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::netbox::{self, NetBoxClient};
use crate::AppState;

use super::ApiError;

/// Helper to get NetBox config and validate it's configured
fn require_config(config: &NetBoxConfig) -> Result<(), ApiError> {
    if config.url.is_empty() || config.token.is_empty() {
        return Err(ApiError::bad_request("NetBox not configured"));
    }
    Ok(())
}

/// Create a NetBoxClient from config
fn make_client(config: &NetBoxConfig) -> Result<NetBoxClient, ApiError> {
    NetBoxClient::new(config.url.clone(), config.token.clone())
        .map_err(|e| ApiError::internal(format!("Failed to create NetBox client: {}", e)))
}

/// Get NetBox connection status
pub async fn get_status(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<NetBoxStatus>, ApiError> {
    let config = state.store.get_netbox_config().await?;

    let connected = if !config.url.is_empty() && !config.token.is_empty() {
        let nb = make_client(&config)?;
        nb.test_connection().await
    } else {
        false
    };

    Ok(Json(NetBoxStatus {
        configured: !config.url.is_empty(),
        connected,
        url: config.url,
        sync_enabled: config.sync_enabled,
    }))
}

/// Get NetBox configuration
pub async fn get_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<NetBoxConfig>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    Ok(Json(config))
}

/// Update NetBox configuration
pub async fn update_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(config): Json<NetBoxConfig>,
) -> Result<Json<NetBoxConfig>, ApiError> {
    state.store.save_netbox_config(&config).await?;
    Ok(Json(config))
}

/// Push devices to NetBox
pub async fn sync_push(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<netbox::SyncResult>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let result = netbox::sync_push(&state.store, &nb, &config).await?;
    Ok(Json(result))
}

/// Pull devices from NetBox
pub async fn sync_pull(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<netbox::SyncResult>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let result = netbox::sync_pull(&state.store, &nb).await?;
    Ok(Json(result))
}

/// Push vendors to NetBox as manufacturers
pub async fn sync_vendors_push(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<netbox::SyncResult>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let result = netbox::sync_vendors_push(&state.store, &nb).await?;
    Ok(Json(result))
}

/// Pull manufacturers from NetBox as vendors
pub async fn sync_vendors_pull(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<netbox::SyncResult>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let result = netbox::sync_vendors_pull(&state.store, &nb).await?;
    Ok(Json(result))
}

/// Get manufacturers from NetBox
pub async fn get_manufacturers(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NetBoxItem>>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let manufacturers = nb.list_manufacturers().await?;

    let items: Vec<NetBoxItem> = manufacturers
        .into_iter()
        .map(|m| NetBoxItem {
            id: m.id,
            name: m.name,
            slug: Some(m.slug),
        })
        .collect();

    Ok(Json(items))
}

/// Get sites from NetBox
pub async fn get_sites(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NetBoxItem>>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let sites = nb.list_sites().await?;

    let items: Vec<NetBoxItem> = sites
        .into_iter()
        .map(|s| NetBoxItem {
            id: s.id,
            name: s.name,
            slug: Some(s.slug),
        })
        .collect();

    Ok(Json(items))
}

/// Get device roles from NetBox
pub async fn get_device_roles(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NetBoxItem>>, ApiError> {
    let config = state.store.get_netbox_config().await?;
    require_config(&config)?;

    let nb = make_client(&config)?;
    let roles = nb.list_device_roles().await?;

    let items: Vec<NetBoxItem> = roles
        .into_iter()
        .map(|r| NetBoxItem {
            id: r.id,
            name: r.name,
            slug: Some(r.slug),
        })
        .collect();

    Ok(Json(items))
}

// --- Helper types for handler responses ---

#[derive(serde::Serialize)]
pub struct NetBoxStatus {
    pub configured: bool,
    pub connected: bool,
    pub url: String,
    pub sync_enabled: bool,
}

#[derive(serde::Serialize)]
pub struct NetBoxItem {
    pub id: i32,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
}
