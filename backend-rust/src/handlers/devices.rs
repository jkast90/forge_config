use axum::{
    extract::{Path, Query, State},
    Json,
};
use std::sync::Arc;
use tera::{Context, Tera};
use tokio::process::Command;

use crate::models::*;
use crate::utils::{normalize_mac, is_valid_ipv4, is_valid_hostname};
use crate::AppState;

use super::{created, trigger_reload, ApiError, PaginationQuery};

/// List all devices (with optional pagination)
pub async fn list_devices(
    State(state): State<Arc<AppState>>,
    Query(page): Query<PaginationQuery>,
) -> Result<Json<Vec<Device>>, ApiError> {
    let (limit, offset) = page.sanitize();
    let devices = state.store.list_devices_paged(limit, offset).await?;
    Ok(Json(devices))
}

/// Get a single device by MAC
pub async fn get_device(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<Device>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state
        .store
        .get_device(&mac)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;
    Ok(Json(device))
}

/// Create a new device
pub async fn create_device(
    State(state): State<Arc<AppState>>,
    Json(mut req): Json<CreateDeviceRequest>,
) -> Result<(axum::http::StatusCode, Json<Device>), ApiError> {
    req.mac = normalize_mac(&req.mac);

    if req.mac.is_empty() || req.ip.is_empty() || req.hostname.is_empty() {
        return Err(ApiError::bad_request("mac, ip, and hostname are required"));
    }
    if !is_valid_ipv4(&req.ip) {
        return Err(ApiError::bad_request("invalid IPv4 address"));
    }
    if !is_valid_hostname(&req.hostname) {
        return Err(ApiError::bad_request("invalid hostname: only alphanumeric, hyphens, dots, and underscores allowed"));
    }

    // Check for duplicate
    if state.store.get_device(&req.mac).await?.is_some() {
        return Err(ApiError::conflict("device with this MAC already exists"));
    }

    let device = state.store.create_device(&req).await?;

    // Remove from discovered_devices since it's now a configured device
    let _ = state.store.delete_discovered_device(&req.mac).await;

    trigger_reload(&state).await;
    Ok(created(device))
}

/// Update an existing device
pub async fn update_device(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
    Json(req): Json<UpdateDeviceRequest>,
) -> Result<Json<Device>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state.store.update_device(&mac, &req).await?;
    trigger_reload(&state).await;
    Ok(Json(device))
}

/// Delete a device
pub async fn delete_device(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    let mac = normalize_mac(&mac);
    state.store.delete_device(&mac).await?;
    trigger_reload(&state).await;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Test connectivity to a device via ping and SSH
pub async fn connect_device(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<ConnectResult>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state
        .store
        .get_device(&mac)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Resolve SSH credentials: device -> vendor -> global defaults
    let settings = state.store.get_settings().await?;
    let vendor = match device.vendor.as_deref() {
        Some(v) if !v.is_empty() => state.store.get_vendor(v).await.ok().flatten(),
        _ => None,
    };
    let ssh_user = device.ssh_user.clone().filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_user.clone()))
        .unwrap_or(settings.default_ssh_user.clone());
    let ssh_pass = device.ssh_pass.clone().filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_pass.clone()))
        .unwrap_or(settings.default_ssh_pass.clone());

    // Ping check
    let ping_result = ping_device(&device.ip).await;

    // SSH check with vendor-aware probe
    let ssh_result = if !ssh_user.is_empty() && !ssh_pass.is_empty() {
        ssh_probe(&device.ip, &ssh_user, &ssh_pass, device.vendor.as_deref()).await
    } else {
        SshResult {
            connected: false,
            uptime: None,
            hostname: None,
            version: None,
            interfaces: None,
            error: Some("No SSH credentials configured".to_string()),
        }
    };

    let success = ping_result.reachable && ssh_result.connected;

    // Update device status based on connectivity
    if ping_result.reachable {
        let _ = state.store.update_device_status(&device.mac, crate::models::device_status::ONLINE).await;
    }

    Ok(Json(ConnectResult {
        ping: ping_result,
        ssh: ssh_result,
        success,
    }))
}

/// Get the generated configuration for a device
pub async fn get_device_config(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<DeviceConfigResponse>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state
        .store
        .get_device(&mac)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Build config file path
    let filename = format!("{}.cfg", mac.replace(':', "_"));
    let config_path = std::path::Path::new(&state.config.tftp_dir).join(&filename);

    let (content, exists) = match tokio::fs::read_to_string(&config_path).await {
        Ok(content) => (content, true),
        Err(_) => (String::new(), false),
    };

    Ok(Json(DeviceConfigResponse {
        mac,
        hostname: device.hostname,
        filename,
        content,
        exists,
    }))
}

async fn ping_device(ip: &str) -> PingResult {
    if !crate::utils::is_valid_ipv4(ip) {
        return PingResult {
            reachable: false,
            latency: None,
            error: Some("Invalid IP address".to_string()),
        };
    }

    let output = Command::new("ping")
        .args(["-c", "3", "-W", "2", ip])
        .output()
        .await;

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let latency = parse_ping_latency(&stdout);
            PingResult {
                reachable: true,
                latency,
                error: None,
            }
        }
        _ => PingResult {
            reachable: false,
            latency: None,
            error: Some("Host unreachable".to_string()),
        },
    }
}

fn parse_ping_latency(output: &str) -> Option<String> {
    // Parse average time from ping stats line
    for line in output.lines() {
        if line.contains("avg") {
            let parts: Vec<&str> = line.split('/').collect();
            if parts.len() >= 5 {
                let val = parts[4].trim_end_matches(" ms").trim_end_matches("ms");
                return Some(format!("{}ms", val));
            }
        }
    }
    None
}

async fn ssh_probe(ip: &str, user: &str, pass: &str, vendor_hint: Option<&str>) -> SshResult {
    let (connected, probe, error) = crate::utils::ssh_probe_device(ip, user, pass, vendor_hint).await;
    SshResult {
        connected,
        uptime: probe.uptime,
        hostname: probe.hostname,
        version: probe.version,
        interfaces: probe.interfaces,
        error,
    }
}

/// Test connectivity to an arbitrary IP (for discovery/containers that aren't registered devices)
pub async fn connect_ip(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ConnectIpRequest>,
) -> Result<Json<ConnectResult>, ApiError> {
    if !is_valid_ipv4(&body.ip) {
        return Err(ApiError::bad_request("Invalid IP address"));
    }

    // Resolve SSH credentials: request -> vendor -> global defaults
    let settings = state.store.get_settings().await?;
    let vendor = match body.vendor.as_deref() {
        Some(v) if !v.is_empty() => state.store.get_vendor(v).await.ok().flatten(),
        _ => None,
    };
    let ssh_user = body.ssh_user
        .filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_user.clone()))
        .unwrap_or(settings.default_ssh_user.clone());
    let ssh_pass = body.ssh_pass
        .filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_pass.clone()))
        .unwrap_or(settings.default_ssh_pass.clone());

    let ping_result = ping_device(&body.ip).await;

    let ssh_result = if !ssh_user.is_empty() && !ssh_pass.is_empty() {
        ssh_probe(&body.ip, &ssh_user, &ssh_pass, body.vendor.as_deref()).await
    } else {
        SshResult {
            connected: false,
            uptime: None,
            hostname: None,
            version: None,
            interfaces: None,
            error: Some("No SSH credentials configured".to_string()),
        }
    };

    let success = ping_result.reachable && ssh_result.connected;

    Ok(Json(ConnectResult {
        ping: ping_result,
        ssh: ssh_result,
        success,
    }))
}

/// Render a device's template with its real data and return the preview
fn render_device_config(
    device: &Device,
    template: &Template,
    settings: &Settings,
) -> Result<String, ApiError> {
    let tera_content = crate::utils::convert_go_template_to_tera(&template.content);

    let mut tera = Tera::default();
    tera.add_raw_template("device", &tera_content)
        .map_err(|e| ApiError::bad_request(format!("Invalid template: {}", e)))?;

    let mut context = Context::new();
    context.insert("Hostname", &device.hostname);
    context.insert("MAC", &device.mac);
    context.insert("IP", &device.ip);
    context.insert("Vendor", &device.vendor.clone().unwrap_or_default());
    context.insert("Model", &device.model.clone().unwrap_or_default());
    context.insert("SerialNumber", &device.serial_number.clone().unwrap_or_default());
    context.insert("Subnet", &settings.dhcp_subnet);
    context.insert("Gateway", &settings.dhcp_gateway);

    tera.render("device", &context)
        .map_err(|e| ApiError::bad_request(format!("Template rendering failed: {}", e)))
}

/// Preview the rendered configuration for a device
pub async fn preview_device_config(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<DeviceConfigPreviewResponse>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state
        .store
        .get_device(&mac)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    if device.config_template.is_empty() {
        return Err(ApiError::bad_request("Device has no template assigned"));
    }

    let template = state
        .store
        .get_template(&device.config_template)
        .await?
        .ok_or_else(|| ApiError::not_found("template"))?;

    let settings = state.store.get_settings().await?;
    let content = render_device_config(&device, &template, &settings)?;

    Ok(Json(DeviceConfigPreviewResponse {
        mac,
        hostname: device.hostname,
        template_id: template.id,
        template_name: template.name,
        content,
    }))
}

/// Deploy rendered configuration to a device via SSH
pub async fn deploy_device_config(
    State(state): State<Arc<AppState>>,
    Path(mac): Path<String>,
) -> Result<Json<DeployConfigResponse>, ApiError> {
    let mac = normalize_mac(&mac);
    let device = state
        .store
        .get_device(&mac)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    if device.config_template.is_empty() {
        return Err(ApiError::bad_request("Device has no template assigned"));
    }

    let template = state
        .store
        .get_template(&device.config_template)
        .await?
        .ok_or_else(|| ApiError::not_found("template"))?;

    let settings = state.store.get_settings().await?;
    let rendered_config = render_device_config(&device, &template, &settings)?;

    // Resolve SSH credentials: device -> vendor -> global
    let vendor = match device.vendor.as_deref() {
        Some(v) if !v.is_empty() => state.store.get_vendor(v).await.ok().flatten(),
        _ => None,
    };
    let ssh_user = device.ssh_user.clone().filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_user.clone()))
        .unwrap_or(settings.default_ssh_user.clone());
    let ssh_pass = device.ssh_pass.clone().filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_pass.clone()))
        .unwrap_or(settings.default_ssh_pass.clone());

    if ssh_user.is_empty() || ssh_pass.is_empty() {
        return Err(ApiError::bad_request("No SSH credentials available for this device"));
    }

    // Wrap config with vendor deploy_command if set
    let deploy_payload = if let Some(ref v) = vendor {
        if !v.deploy_command.is_empty() {
            v.deploy_command.replace("{CONFIG}", &rendered_config)
        } else {
            rendered_config.clone()
        }
    } else {
        rendered_config.clone()
    };

    match crate::utils::ssh_run_command_async(&device.ip, &ssh_user, &ssh_pass, &deploy_payload).await {
        Ok(output) => {
            let _ = state.store.update_device_status(&mac, crate::models::device_status::ONLINE).await;
            Ok(Json(DeployConfigResponse {
                mac,
                hostname: device.hostname,
                success: true,
                output,
                error: None,
            }))
        }
        Err(e) => {
            Ok(Json(DeployConfigResponse {
                mac,
                hostname: device.hostname,
                success: false,
                output: String::new(),
                error: Some(e.to_string()),
            }))
        }
    }
}
