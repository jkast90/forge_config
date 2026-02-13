use axum::{
    extract::{Path, Query, State},
    Json,
};
use std::sync::Arc;

use crate::dhcp::parse_lease_file;
use crate::models::*;
use crate::utils::humanize_requested_options;
use crate::AppState;

use super::{ApiError, MessageResponse, PaginationQuery};

/// Enrich leases with vendor detection and DHCP request metadata
async fn enrich_leases_with_dhcp_info(leases: &mut [Lease], store: &crate::db::Store) {
    let vendors = match store.list_vendors().await {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!("Failed to load vendors for lease enrichment: {}", e);
            return;
        }
    };

    for lease in leases.iter_mut() {
        if let Some((vendor_id, _method)) = crate::utils::detect_vendor(&lease.mac, &vendors) {
            lease.vendor = Some(vendor_id);
        }
        crate::utils::enrich_lease_with_dhcp_info(lease);
    }
}

/// List undiscovered devices — merges active DHCP leases with persisted discoveries from DB.
/// Devices already added to the devices table are excluded.
pub async fn list_undiscovered(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Lease>>, ApiError> {
    // Get all known devices (already configured)
    let devices = state.store.list_devices().await?;
    let known_macs: std::collections::HashSet<_> = devices.iter().map(|d| d.mac.to_lowercase()).collect();

    // Start with persisted discovered devices from DB (excludes configured devices)
    let db_discovered = state.store.list_discovered_devices().await?;

    // Parse active lease file and enrich with DHCP info
    let mut leases = parse_lease_file(&state.config.lease_path).await?;
    enrich_leases_with_dhcp_info(&mut leases, &state.store).await;

    // Build a map of DB records keyed by MAC for merging
    let mut result_map: std::collections::HashMap<String, Lease> = db_discovered
        .into_iter()
        .map(|l| (l.mac.to_lowercase(), l))
        .collect();

    // Overlay active lease data (fresher IP, expiry, hostname)
    for lease in leases {
        let mac_lower = lease.mac.to_lowercase();
        if known_macs.contains(&mac_lower) {
            continue;
        }
        // Active lease data takes priority — it has current IP/expiry
        result_map.insert(mac_lower, lease);
    }

    let mut result: Vec<Lease> = result_map.into_values().collect();
    result.sort_by(|a, b| a.mac.cmp(&b.mac));

    // Humanize requested_options for any DB-sourced records that still have raw numbers
    for lease in &mut result {
        if let Some(opts) = &lease.requested_options {
            if opts.chars().next().map_or(false, |c| c.is_ascii_digit()) {
                lease.requested_options = Some(humanize_requested_options(opts));
            }
        }
    }

    Ok(Json(result))
}

/// Get current DHCP leases
pub async fn list_leases(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Lease>>, ApiError> {
    let mut leases = parse_lease_file(&state.config.lease_path).await?;
    enrich_leases_with_dhcp_info(&mut leases, &state.store).await;
    Ok(Json(leases))
}

/// List discovery event logs
pub async fn list_discovery_logs(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Query(page): Query<PaginationQuery>,
) -> Result<Json<Vec<DiscoveryLog>>, ApiError> {
    let (limit, _offset) = page.sanitize();
    let logs = state.store.list_discovery_logs(limit).await?;
    Ok(Json(logs))
}

/// Clear discovery tracking (resets known MACs and persisted discoveries)
pub async fn clear_discovery(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    // Clear known MACs in lease watcher
    if let Some(lease_watcher) = &state.lease_watcher {
        let watcher = lease_watcher.read().await;
        watcher.clear_known_macs().await;
    }
    // Clear persisted discovered devices from DB
    state.store.clear_discovered_devices().await?;
    Ok(MessageResponse::new("discovery tracking cleared"))
}

/// Clear discovery logs
pub async fn clear_discovery_logs(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    state.store.clear_discovery_logs().await?;
    Ok(MessageResponse::new("Discovery logs cleared"))
}

/// Dismiss a single discovered device
pub async fn dismiss_discovered_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<MessageResponse>, ApiError> {
    let mac = crate::utils::normalize_mac(&mac);
    state.store.delete_discovered_device(&mac).await?;
    Ok(MessageResponse::new(&format!("Dismissed {}", mac)))
}
