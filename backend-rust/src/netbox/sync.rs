use anyhow::Result;
use std::collections::HashMap;

use crate::db::Store;
use crate::models::{CreateDeviceRequest, CreateVendorRequest, NetBoxConfig, device_status};

use super::client::NetBoxClient;
use super::types::{DeviceCreate, SyncCounts, SyncResult};

fn slugify(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn map_status_to_netbox(status: &str) -> &str {
    match status {
        device_status::ONLINE => "active",
        device_status::OFFLINE => "offline",
        device_status::PROVISIONING => "staged",
        _ => "planned",
    }
}

fn map_status_from_netbox(status: &str) -> &str {
    match status {
        "active" => device_status::ONLINE,
        "offline" => device_status::OFFLINE,
        "staged" => device_status::PROVISIONING,
        _ => device_status::OFFLINE,
    }
}

/// Push all devices from local DB to NetBox
pub async fn sync_push(store: &Store, nb: &NetBoxClient, config: &NetBoxConfig) -> Result<SyncResult> {
    let devices = store.list_devices().await?;
    let vendors = store.list_vendors().await?;

    // Ensure prerequisites (site + role)
    let site = nb.get_or_create_site("ZTP Lab", "ztp-lab").await?;
    let role = nb.get_or_create_role("Network Device", "network-device", "2196f3").await?;

    let site_id = if config.site_id > 0 { config.site_id } else { site.id };
    let role_id = if config.role_id > 0 { config.role_id } else { role.id };

    let mut created = 0;
    let mut updated = 0;
    let mut errors: Vec<String> = Vec::new();

    for device in &devices {
        // Find vendor to get manufacturer
        let vendor = device
            .vendor
            .as_ref()
            .and_then(|v| v.parse::<i64>().ok())
            .and_then(|vid| vendors.iter().find(|vd| vd.id == vid));

        let vendor_name = vendor.map(|v| v.name.as_str()).unwrap_or("Generic");
        let vendor_slug = slugify(vendor_name);

        // Ensure manufacturer
        let manufacturer = match nb.get_manufacturer_by_slug(&vendor_slug).await {
            Ok(Some(m)) => m,
            Ok(None) => match nb.create_manufacturer(vendor_name, &vendor_slug).await {
                Ok(m) => m,
                Err(e) => {
                    errors.push(format!("{}: manufacturer: {}", device.hostname, e));
                    continue;
                }
            },
            Err(e) => {
                errors.push(format!("{}: manufacturer lookup: {}", device.hostname, e));
                continue;
            }
        };

        // Ensure device type
        let model = format!("{} Device", vendor_name);
        let model_slug = slugify(&model);
        let device_type = match nb.get_or_create_device_type(manufacturer.id, &model, &model_slug).await {
            Ok(dt) => dt,
            Err(e) => {
                errors.push(format!("{}: device type: {}", device.hostname, e));
                continue;
            }
        };

        // Build custom fields
        let mut custom_fields = HashMap::new();
        custom_fields.insert("mac_address".to_string(), serde_json::json!(device.mac));
        custom_fields.insert("fc_managed".to_string(), serde_json::json!(true));

        let nb_device = DeviceCreate {
            name: device.hostname.clone(),
            device_type: device_type.id,
            role: role_id,
            site: site_id,
            status: map_status_to_netbox(&device.status).to_string(),
            serial: device.serial_number.clone(),
            custom_fields: Some(custom_fields),
        };

        // Check if device already exists
        match nb.get_device_by_name(&device.hostname).await {
            Ok(Some(existing)) => {
                if let Err(e) = nb.update_device(existing.id, &nb_device).await {
                    errors.push(format!("{}: update: {}", device.hostname, e));
                } else {
                    updated += 1;
                }
            }
            Ok(None) => {
                match nb.create_device(&nb_device).await {
                    Ok(nb_dev) => {
                        // Create management interface with MAC
                        if let Err(e) = nb.create_interface(nb_dev.id, "Management0", device.mac.as_deref()).await {
                            tracing::warn!("Failed to create interface for {}: {}", device.hostname, e);
                        }
                        created += 1;
                    }
                    Err(e) => {
                        errors.push(format!("{}: create: {}", device.hostname, e));
                    }
                }
            }
            Err(e) => {
                errors.push(format!("{}: lookup: {}", device.hostname, e));
            }
        }
    }

    Ok(SyncResult {
        message: format!("Pushed {} devices ({} created, {} updated)", devices.len(), created, updated),
        result: SyncCounts { created, updated, errors },
    })
}

/// Pull devices from NetBox into local DB
pub async fn sync_pull(store: &Store, nb: &NetBoxClient) -> Result<SyncResult> {
    let nb_devices = nb.list_devices().await?;
    let mut created = 0;
    let mut updated = 0;
    let mut errors: Vec<String> = Vec::new();

    for nb_device in &nb_devices {
        let name = match &nb_device.name {
            Some(n) if !n.is_empty() => n.clone(),
            _ => continue,
        };

        // Try to get MAC from interfaces
        let mac = if let Ok(interfaces) = nb.list_interfaces_by_device(nb_device.id).await {
            interfaces
                .iter()
                .find_map(|i| i.mac_address.clone())
        } else {
            None
        };

        // Fallback to custom fields
        let mac = mac.or_else(|| {
            nb_device
                .custom_fields
                .as_ref()
                .and_then(|cf| cf.get("mac_address"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

        let mac = match mac {
            Some(m) if !m.is_empty() => crate::utils::normalize_mac(&m),
            _ => continue, // Skip devices without MAC
        };

        // Get IP from primary_ip4
        let ip = nb_device
            .primary_ip4
            .as_ref()
            .map(|ip| ip.address.split('/').next().unwrap_or(&ip.address).to_string())
            .unwrap_or_default();

        if ip.is_empty() {
            continue; // Skip devices without IP
        }

        // Map vendor from manufacturer
        let vendor = nb_device
            .device_type
            .as_ref()
            .and_then(|dt| dt.slug.clone());

        let _status = nb_device
            .status
            .as_ref()
            .map(|s| map_status_from_netbox(&s.value))
            .unwrap_or("offline");

        // Check if device already exists in local DB
        match store.get_device_by_mac(&mac).await {
            Ok(Some(_)) => {
                updated += 1; // Already exists, skip
            }
            Ok(None) => {
                let req = CreateDeviceRequest {
                    mac: mac.clone(),
                    ip,
                    hostname: name,
                    vendor,
                    model: None,
                    serial_number: if nb_device.serial.is_empty() { None } else { Some(nb_device.serial.clone()) },
                    config_template: String::new(),
                    ssh_user: None,
                    ssh_pass: None,
                    topology_id: None,
                    topology_role: None,
                    device_type: None,
                    hall_id: None,
                    row_id: None,
                    rack_id: None,
                    rack_position: None,
                };

                match store.create_device(&req).await {
                    Ok(_) => created += 1,
                    Err(e) => errors.push(format!("{}: {}", mac, e)),
                }
            }
            Err(e) => errors.push(format!("{}: lookup: {}", mac, e)),
        }
    }

    Ok(SyncResult {
        message: format!("Pulled {} devices ({} created, {} existing)", nb_devices.len(), created, updated),
        result: SyncCounts { created, updated, errors },
    })
}

/// Push vendors to NetBox as manufacturers
pub async fn sync_vendors_push(store: &Store, nb: &NetBoxClient) -> Result<SyncResult> {
    let vendors = store.list_vendors().await?;
    let mut created = 0;
    let mut updated = 0;
    let mut errors: Vec<String> = Vec::new();

    for vendor in &vendors {
        let slug = slugify(&vendor.name);

        match nb.get_manufacturer_by_slug(&slug).await {
            Ok(Some(_)) => {
                updated += 1;
            }
            Ok(None) => {
                match nb.create_manufacturer(&vendor.name, &slug).await {
                    Ok(_) => created += 1,
                    Err(e) => errors.push(format!("{}: {}", vendor.name, e)),
                }
            }
            Err(e) => errors.push(format!("{}: {}", vendor.name, e)),
        }
    }

    Ok(SyncResult {
        message: format!("Pushed {} vendors ({} created, {} existing)", vendors.len(), created, updated),
        result: SyncCounts { created, updated, errors },
    })
}

/// Pull manufacturers from NetBox as vendors
pub async fn sync_vendors_pull(store: &Store, nb: &NetBoxClient) -> Result<SyncResult> {
    let manufacturers = nb.list_manufacturers().await?;
    let mut created = 0;
    let mut updated = 0;
    let mut errors: Vec<String> = Vec::new();

    for mfr in &manufacturers {
        match store.get_vendor_by_name(&mfr.name).await {
            Ok(Some(_)) => {
                updated += 1;
            }
            Ok(None) => {
                let req = CreateVendorRequest {
                    name: mfr.name.clone(),
                    backup_command: "show running-config".to_string(),
                    deploy_command: String::new(),
                    diff_command: String::new(),
                    ssh_port: 22,
                    ssh_user: String::new(),
                    ssh_pass: String::new(),
                    mac_prefixes: Vec::new(),
                    vendor_class: String::new(),
                    default_template: String::new(),
                    group_names: Vec::new(),
                };

                match store.create_vendor(&req).await {
                    Ok(_) => created += 1,
                    Err(e) => errors.push(format!("{}: {}", mfr.name, e)),
                }
            }
            Err(e) => errors.push(format!("{}: {}", mfr.name, e)),
        }
    }

    Ok(SyncResult {
        message: format!("Pulled {} manufacturers ({} created, {} existing)", manufacturers.len(), created, updated),
        result: SyncCounts { created, updated, errors },
    })
}
