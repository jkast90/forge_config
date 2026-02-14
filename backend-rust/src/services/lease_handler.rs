use std::sync::Arc;

use crate::backup::BackupService;
use crate::db::Store;
use crate::models::{CreateDiscoveryLogRequest, Lease, discovery_event};
use crate::utils;
use crate::ws::Hub;

/// Handle a new or renewed DHCP lease event.
/// Performs vendor detection, persists the discovered device, sends WebSocket
/// notifications, and creates a discovery log entry.
pub fn on_lease_event(
    store: Store,
    backup_svc: Arc<BackupService>,
    ws_hub: Arc<Hub>,
    lease: Lease,
) {
    tokio::spawn(async move {
        // Backup callback
        backup_svc.on_new_lease(lease.clone()).await;

        // Auto-detect vendor from MAC prefix and DHCP vendor class
        let detected_vendor = match store.list_vendors().await {
            Ok(vendors) => utils::detect_vendor(&lease.mac, &vendors),
            Err(_) => None,
        };
        let vendor_id = detected_vendor.as_ref().map(|(id, _)| id.as_str());
        let detection_method = detected_vendor.as_ref().map(|(_, m)| *m);

        // Build an enriched lease with DHCP info for persistence
        let mut enriched_lease = lease.clone();
        enriched_lease.vendor = vendor_id.map(|s| s.to_string());
        utils::enrich_lease_with_dhcp_info(&mut enriched_lease);

        // Persist discovered device to DB
        if let Err(e) = store.upsert_discovered_device(&enriched_lease).await {
            tracing::warn!("Failed to persist discovered device {}: {}", lease.mac, e);
        }

        // WebSocket notification callback (now with vendor)
        ws_hub
            .broadcast_device_discovered(&lease.mac, &lease.ip, Some(&lease.hostname), vendor_id)
            .await;

        // Discovery log callback
        let event_type = if store.get_device_by_mac(&lease.mac).await.ok().flatten().is_some() {
            discovery_event::LEASE_RENEWED
        } else {
            discovery_event::DISCOVERED
        };

        let message = match (event_type, detection_method) {
            (discovery_event::DISCOVERED, Some(method)) => {
                format!("New device detected via DHCP (vendor detected via {})", method)
            }
            (discovery_event::DISCOVERED, None) => "New device detected via DHCP".to_string(),
            (_, Some(method)) => {
                format!("DHCP lease renewed (vendor detected via {})", method)
            }
            _ => "DHCP lease renewed for configured device".to_string(),
        };

        let log_req = CreateDiscoveryLogRequest {
            event_type: event_type.to_string(),
            mac: lease.mac.clone(),
            ip: lease.ip.clone(),
            hostname: Some(lease.hostname.clone()),
            vendor: vendor_id.map(|s| s.to_string()),
            message: Some(message),
        };

        if let Err(e) = store.create_discovery_log(&log_req).await {
            tracing::warn!("Failed to create discovery log: {}", e);
        }
    });
}
