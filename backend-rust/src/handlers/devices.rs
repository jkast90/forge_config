use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use std::sync::Arc;
use tera::{Context, Tera};
use tokio::process::Command;

use serde::Deserialize;

use crate::models::*;
use crate::utils::{normalize_mac, is_valid_ipv4, is_valid_hostname};
use crate::AppState;

use super::{created, trigger_reload, ApiError, PaginationQuery};

/// List all devices (with optional pagination)
pub async fn list_devices(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Query(page): Query<PaginationQuery>,
) -> Result<Json<Vec<Device>>, ApiError> {
    let (limit, offset) = page.sanitize();
    let devices = state.store.list_devices_paged(limit, offset).await?;
    Ok(Json(devices))
}

/// Get a single device by ID
pub async fn get_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Device>, ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;
    Ok(Json(device))
}

/// Create a new device
pub async fn create_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(mut req): Json<CreateDeviceRequest>,
) -> Result<(axum::http::StatusCode, Json<Device>), ApiError> {
    // Normalize MAC if provided and non-empty
    if !req.mac.is_empty() {
        req.mac = normalize_mac(&req.mac);
    }

    if req.hostname.is_empty() {
        return Err(ApiError::bad_request("hostname is required"));
    }
    // Validate IP only if non-empty (patch panels may have no IP)
    if !req.ip.is_empty() && !is_valid_ipv4(&req.ip) {
        return Err(ApiError::bad_request("invalid IPv4 address"));
    }
    if !is_valid_hostname(&req.hostname) {
        return Err(ApiError::bad_request("invalid hostname: only alphanumeric, hyphens, dots, and underscores allowed"));
    }

    // Validate topology_role if provided
    if let Some(ref role) = req.topology_role {
        if !crate::models::topology_role::is_valid(role) {
            return Err(ApiError::bad_request("topology_role must be one of: super-spine, spine, leaf"));
        }
    }

    let device = state.store.create_device(&req).await?;

    // Remove from discovered_devices since it's now a configured device
    let _ = state.store.delete_discovered_device(&req.mac).await;

    trigger_reload(&state).await;
    Ok(created(device))
}

/// Update an existing device
pub async fn update_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateDeviceRequest>,
) -> Result<Json<Device>, ApiError> {
    // Validate topology_role if provided
    if let Some(ref role) = req.topology_role {
        if !crate::models::topology_role::is_valid(role) {
            return Err(ApiError::bad_request("topology_role must be one of: super-spine, spine, leaf"));
        }
    }

    let device = state.store.update_device(id, &req).await?;
    trigger_reload(&state).await;
    Ok(Json(device))
}

/// Delete a device
pub async fn delete_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_device(id).await?;
    trigger_reload(&state).await;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Test connectivity to a device via ping and SSH
pub async fn connect_device(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<ConnectResult>, ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    let (ssh_user, ssh_pass) = crate::utils::resolve_ssh_credentials(
        &state.store, device.ssh_user.clone(), device.ssh_pass.clone(), device.vendor.as_deref(),
    ).await;

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
        let _ = state.store.update_device_status(device.id, crate::models::device_status::ONLINE).await;
    }

    Ok(Json(ConnectResult {
        ping: ping_result,
        ssh: ssh_result,
        success,
    }))
}

/// Get the generated configuration for a device
pub async fn get_device_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<DeviceConfigResponse>, ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Build config file path using MAC address
    let mac = device.mac.clone().unwrap_or_default();
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
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(body): Json<ConnectIpRequest>,
) -> Result<Json<ConnectResult>, ApiError> {
    if !is_valid_ipv4(&body.ip) {
        return Err(ApiError::bad_request("Invalid IP address"));
    }

    let (ssh_user, ssh_pass) = crate::utils::resolve_ssh_credentials(
        &state.store, body.ssh_user, body.ssh_pass, body.vendor.as_deref(),
    ).await;

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

/// Execute a command on a device via SSH or webhook — creates a job and returns 202 Accepted
pub async fn exec_command(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(body): Json<ExecRequest>,
) -> Result<(StatusCode, Json<Job>), ApiError> {
    let _device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Determine job type: if action_id is provided and the action is a webhook, create a webhook job
    let (jt, command) = if let Some(action_id) = body.action_id {
        let action = state.store.get_vendor_action(action_id).await
            .map_err(|e| ApiError::internal(e.to_string()))?
            .ok_or_else(|| ApiError::not_found("vendor action"))?;

        if action.action_type == "webhook" {
            // For webhook jobs, store the action_id in the command field
            (job_type::WEBHOOK.to_string(), action.id.to_string())
        } else {
            // SSH action — use its command
            (job_type::COMMAND.to_string(), action.command.clone())
        }
    } else {
        if body.command.is_empty() {
            return Err(ApiError::bad_request("command or action_id is required"));
        }
        (job_type::COMMAND.to_string(), body.command.clone())
    };

    let job_id = uuid::Uuid::new_v4().to_string();
    let req = CreateJobRequest {
        device_id: id,
        job_type: jt,
        command,
        credential_id: String::new(),
    };

    let job = state.store.create_job(&job_id, &req).await?;

    // Broadcast queued event
    if let Some(ref hub) = state.ws_hub {
        hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
    }

    // Submit to worker
    if let Some(ref job_service) = state.job_service {
        job_service.submit(job_id).await;
    }

    Ok((StatusCode::ACCEPTED, Json(job)))
}

/// Render a device's template with its real data and return the preview
fn render_device_config(
    device: &Device,
    template: &Template,
    settings: &Settings,
    role_template: Option<&Template>,
    vars: &std::collections::HashMap<String, String>,
) -> Result<String, ApiError> {
    let tera_content = crate::utils::convert_go_template_to_tera(&template.content);

    let mut tera = Tera::default();
    tera.add_raw_template("device", &tera_content)
        .map_err(|e| ApiError::bad_request(format!("Invalid template: {}", e)))?;

    // Register role template as "role" so the device template can {% include "role" %}
    if let Some(role_tmpl) = role_template {
        let role_content = crate::utils::convert_go_template_to_tera(&role_tmpl.content);
        tera.add_raw_template("role", &role_content)
            .map_err(|e| ApiError::bad_request(format!("Invalid role template: {}", e)))?;
    } else {
        // Register an empty role template so {% include "role" %} doesn't fail
        tera.add_raw_template("role", "")
            .map_err(|e| ApiError::bad_request(format!("Failed to add empty role template: {}", e)))?;
    }

    let mut context = Context::new();
    context.insert("Hostname", &device.hostname);
    context.insert("MAC", &device.mac.clone().unwrap_or_default());
    context.insert("IP", &device.ip);
    context.insert("Vendor", &device.vendor.clone().unwrap_or_default());
    context.insert("Model", &device.model.clone().unwrap_or_default());
    context.insert("SerialNumber", &device.serial_number.clone().unwrap_or_default());
    context.insert("TopologyId", &device.topology_id.clone().unwrap_or_default());
    context.insert("TopologyRole", &device.topology_role.clone().unwrap_or_default());
    context.insert("Subnet", &settings.dhcp_subnet);
    context.insert("Gateway", &settings.dhcp_gateway);
    context.insert("vars", vars);

    tera.render("device", &context)
        .map_err(|e| ApiError::bad_request(format!("Template rendering failed: {}", e)))
}

/// Preview the rendered configuration for a device
pub async fn preview_device_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<DeviceConfigPreviewResponse>, ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Resolve template: use device's config_template, or fall back to vendor's default_template
    let template_id: i64 = if !device.config_template.is_empty() {
        device.config_template.parse::<i64>()
            .map_err(|_| ApiError::bad_request(format!("Invalid template ID: {}", device.config_template)))?
    } else if let Some(ref vendor_str) = device.vendor {
        let vendor_id = vendor_str.parse::<i64>()
            .map_err(|_| ApiError::bad_request(format!("Invalid vendor ID: {}", vendor_str)))?;
        let vendor = state.store.get_vendor(vendor_id).await?
            .ok_or_else(|| ApiError::bad_request("Device has no template and vendor not found"))?;
        if vendor.default_template.is_empty() {
            return Err(ApiError::bad_request("Device has no template and vendor has no default template"));
        }
        vendor.default_template.parse::<i64>()
            .map_err(|_| ApiError::bad_request(format!("Invalid default template ID: {}", vendor.default_template)))?
    } else {
        return Err(ApiError::bad_request("Device has no template assigned and no vendor to infer from"));
    };

    let template = state
        .store
        .get_template(template_id)
        .await?
        .ok_or_else(|| ApiError::not_found("template"))?;

    let settings = state.store.get_settings().await?;

    // Look up role-specific template by name convention
    let role_template = if let Some(role) = &device.topology_role {
        let capitalized_role = format!("{}{}", &role[..1].to_uppercase(), &role[1..]);
        let role_name = if template.name.ends_with(" Default") {
            format!("{} {}", template.name.trim_end_matches(" Default"), capitalized_role)
        } else {
            format!("{} {}", template.name, capitalized_role)
        };
        state.store.get_template_by_name(&role_name).await.ok().flatten()
    } else {
        None
    };

    // Load resolved variables (group + host inheritance) for template rendering
    let vars = state
        .store
        .resolve_device_variables_flat(device.id)
        .await
        .unwrap_or_default();

    let content = render_device_config(&device, &template, &settings, role_template.as_ref(), &vars)?;

    Ok(Json(DeviceConfigPreviewResponse {
        mac: device.mac.unwrap_or_default(),
        hostname: device.hostname,
        template_id: template.id,
        template_name: template.name,
        content,
    }))
}

/// Deploy rendered configuration to a device via SSH — creates a job and returns 202 Accepted
pub async fn deploy_device_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<(StatusCode, Json<Job>), ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Resolve template name for job metadata
    let template_name = resolve_job_template_name(&state, &device).await;

    let job_id = uuid::Uuid::new_v4().to_string();
    let req = CreateJobRequest {
        device_id: id,
        job_type: job_type::DEPLOY.to_string(),
        command: template_name,
        credential_id: String::new(),
    };

    let job = state.store.create_job(&job_id, &req).await?;

    // Broadcast queued event
    if let Some(ref hub) = state.ws_hub {
        hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
    }

    // Submit to worker
    if let Some(ref job_service) = state.job_service {
        job_service.submit(job_id).await;
    }

    Ok((StatusCode::ACCEPTED, Json(job)))
}

/// Show a diff of the pending configuration on a device via SSH — creates a job and returns 202 Accepted
pub async fn diff_device_config(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<(StatusCode, Json<Job>), ApiError> {
    let device = state
        .store
        .get_device(id)
        .await?
        .ok_or_else(|| ApiError::not_found("device"))?;

    // Resolve template name for job metadata
    let template_name = resolve_job_template_name(&state, &device).await;

    let job_id = uuid::Uuid::new_v4().to_string();
    let req = CreateJobRequest {
        device_id: id,
        job_type: job_type::DIFF.to_string(),
        command: template_name,
        credential_id: String::new(),
    };

    let job = state.store.create_job(&job_id, &req).await?;

    // Broadcast queued event
    if let Some(ref hub) = state.ws_hub {
        hub.broadcast_job_update(crate::ws::EventType::JobQueued, &job).await;
    }

    // Submit to worker
    if let Some(ref job_service) = state.job_service {
        job_service.submit(job_id).await;
    }

    Ok((StatusCode::ACCEPTED, Json(job)))
}

// ========== Hostname Generation ==========

#[derive(Deserialize)]
pub struct NextHostnameQuery {
    pub role: String,
    pub datacenter: Option<String>,
    pub region: Option<String>,
    pub hall: Option<String>,
}

/// Generate the next available hostname based on the hostname pattern setting
pub async fn next_hostname(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Query(params): Query<NextHostnameQuery>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let hostname = resolve_next_hostname(&state, &params.role, params.datacenter.as_deref(), params.region.as_deref(), params.hall.as_deref()).await?;
    Ok(Json(serde_json::json!({ "hostname": hostname })))
}

/// Resolve the next available hostname for a given role and optional datacenter.
/// Shared by both the API endpoint and the CLOS builder.
pub async fn resolve_next_hostname(
    state: &AppState,
    role: &str,
    datacenter: Option<&str>,
    region: Option<&str>,
    hall: Option<&str>,
) -> Result<String, ApiError> {
    let settings = state.store.get_settings().await?;
    let pattern = &settings.hostname_pattern;

    let dc = datacenter.unwrap_or("");
    let rgn = region.unwrap_or("");
    let hl = hall.unwrap_or("");
    let base = pattern
        .replace("$region", rgn)
        .replace("$datacenter", dc)
        .replace("$hall", hl)
        .replace("$role", role);

    // Clean up leading/trailing hyphens and double hyphens from empty variables
    let mut base = base.trim_matches('-').to_string();
    while base.contains("--") {
        base = base.replace("--", "-");
    }

    // Build a LIKE pattern from the base (replace # with %)
    let like_pattern = base.replace('#', "%");

    let rows = state.store.list_hostnames_matching(&like_pattern)
        .await
        .unwrap_or_default();

    // Build regex to extract the number from matching hostnames
    let re_pattern = format!(
        "^{}$",
        regex_lite::escape(&base).replace(r"\#", r"(\d+)")
    );
    let number_re = regex_lite::Regex::new(&re_pattern).unwrap();

    let max_num = rows
        .iter()
        .filter_map(|h| number_re.captures(h))
        .filter_map(|c| c.get(1)?.as_str().parse::<u32>().ok())
        .max()
        .unwrap_or(0);

    let hostname = base.replace('#', &(max_num + 1).to_string());
    Ok(hostname)
}

/// Resolve the template name for a device (for job metadata).
/// Returns "template_name" or "template_name (role-variant)" or empty string.
async fn resolve_job_template_name(state: &AppState, device: &Device) -> String {
    let template_id: i64 = if !device.config_template.is_empty() {
        match device.config_template.parse::<i64>() {
            Ok(id) => id,
            Err(_) => return String::new(),
        }
    } else if let Some(ref vendor_str) = device.vendor {
        let vendor_id = match vendor_str.parse::<i64>() {
            Ok(id) => id,
            Err(_) => return String::new(),
        };
        match state.store.get_vendor(vendor_id).await {
            Ok(Some(v)) if !v.default_template.is_empty() => {
                match v.default_template.parse::<i64>() {
                    Ok(id) => id,
                    Err(_) => return String::new(),
                }
            }
            _ => return String::new(),
        }
    } else {
        return String::new();
    };

    let template_name = match state.store.get_template(template_id).await {
        Ok(Some(t)) => t.name,
        _ => return template_id.to_string(),
    };

    // Check for role-specific variant by name convention
    if let Some(ref role) = device.topology_role {
        let capitalized_role = format!("{}{}", &role[..1].to_uppercase(), &role[1..]);
        let role_name = if template_name.ends_with(" Default") {
            format!("{} {}", template_name.trim_end_matches(" Default"), capitalized_role)
        } else {
            format!("{} {}", template_name, capitalized_role)
        };
        if let Ok(Some(role_tmpl)) = state.store.get_template_by_name(&role_name).await {
            return format!("{} ({})", template_name, role_tmpl.name);
        }
    }

    template_name
}
