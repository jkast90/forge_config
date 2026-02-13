use axum::{
    extract::{Path, State},
    Json,
};
use std::sync::Arc;
use tera::{Context, Tera};

use crate::models::*;
use crate::AppState;

use super::{created, trigger_reload, ApiError};

/// List all templates
pub async fn list_templates(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Template>>, ApiError> {
    let templates = state.store.list_templates().await?;
    Ok(Json(templates))
}

/// Get a single template by ID
pub async fn get_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Template>, ApiError> {
    let template = state
        .store
        .get_template(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("template"))?;
    Ok(Json(template))
}

/// Create a new template
pub async fn create_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<(axum::http::StatusCode, Json<Template>), ApiError> {
    if req.id.is_empty() || req.name.is_empty() || req.content.is_empty() {
        return Err(ApiError::bad_request("id, name, and content are required"));
    }

    // Check for duplicate
    if state.store.get_template(&req.id).await?.is_some() {
        return Err(ApiError::conflict("template with this ID already exists"));
    }

    let template = state.store.create_template(&req).await?;
    trigger_reload(&state).await;
    Ok(created(template))
}

/// Update an existing template
pub async fn update_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(mut req): Json<CreateTemplateRequest>,
) -> Result<Json<Template>, ApiError> {
    req.id = id.clone();
    let template = state.store.update_template(&id, &req).await?;
    trigger_reload(&state).await;
    Ok(Json(template))
}

/// Delete a template
pub async fn delete_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<axum::http::StatusCode, ApiError> {
    state.store.delete_template(&id).await?;
    trigger_reload(&state).await;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

/// Preview a template with device data (matches Go backend signature)
pub async fn preview_template(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<TemplatePreviewRequest>,
) -> Result<Json<TemplatePreviewResponse>, ApiError> {
    // Get the template
    let template = state
        .store
        .get_template(&id)
        .await?
        .ok_or_else(|| ApiError::not_found("template"))?;

    // Convert Go template syntax to Tera syntax
    let tera_content = convert_go_template_to_tera(&template.content);

    // Create a Tera instance and add the template
    let mut tera = Tera::default();
    tera.add_raw_template("preview", &tera_content)
        .map_err(|e| ApiError::bad_request(format!("Invalid template: {}", e)))?;

    // Look up role-specific template for {% include "role" %} support
    let role = req.device.topology_role.as_deref().unwrap_or("");
    if !role.is_empty() {
        let role_id = format!("{}-{}", id, role);
        if let Ok(Some(role_tmpl)) = state.store.get_template(&role_id).await {
            let role_content = convert_go_template_to_tera(&role_tmpl.content);
            let _ = tera.add_raw_template("role", &role_content);
        }
    }
    // Ensure "role" always exists so {% include "role" %} doesn't fail
    if tera.get_template("role").is_err() {
        let _ = tera.add_raw_template("role", "");
    }

    // Build context from device data
    let mut context = Context::new();
    context.insert("Hostname", &req.device.hostname);
    context.insert("MAC", &req.device.mac);
    context.insert("IP", &req.device.ip);
    context.insert("Vendor", &req.device.vendor.as_deref().unwrap_or(""));
    context.insert("SerialNumber", &req.device.serial_number.as_deref().unwrap_or(""));
    context.insert("SSHUser", &req.device.ssh_user.as_deref().unwrap_or(""));
    context.insert("SSHPass", &req.device.ssh_pass.as_deref().unwrap_or(""));
    context.insert("TopologyId", &req.device.topology_id.as_deref().unwrap_or(""));
    context.insert("TopologyRole", &req.device.topology_role.as_deref().unwrap_or(""));
    context.insert("Subnet", &req.subnet);
    context.insert("Gateway", &req.gateway);

    // Render the template
    let rendered = tera
        .render("preview", &context)
        .map_err(|e| ApiError::bad_request(format!("Template rendering failed: {}", e)))?;

    Ok(Json(TemplatePreviewResponse { output: rendered }))
}

/// Get available template variables
pub async fn get_template_variables(
    _auth: crate::auth::AuthUser,
) -> Result<Json<Vec<TemplateVariable>>, ApiError> {
    Ok(Json(vec![
        TemplateVariable { name: "MAC".into(), description: "Device MAC address".into(), example: "02:42:ac:1e:00:99".into() },
        TemplateVariable { name: "IP".into(), description: "Device IP address".into(), example: "172.30.0.99".into() },
        TemplateVariable { name: "Hostname".into(), description: "Device hostname".into(), example: "switch-01".into() },
        TemplateVariable { name: "Vendor".into(), description: "Device vendor".into(), example: "cisco".into() },
        TemplateVariable { name: "SerialNumber".into(), description: "Device serial number".into(), example: "SN12345".into() },
        TemplateVariable { name: "Subnet".into(), description: "Network subnet mask".into(), example: "255.255.255.0".into() },
        TemplateVariable { name: "Gateway".into(), description: "Default gateway".into(), example: "172.30.0.1".into() },
        TemplateVariable { name: "SSHUser".into(), description: "SSH username (if set)".into(), example: "admin".into() },
        TemplateVariable { name: "SSHPass".into(), description: "SSH password (if set)".into(), example: "password".into() },
        TemplateVariable { name: "TopologyId".into(), description: "CLOS topology ID".into(), example: "dc1-fabric".into() },
        TemplateVariable { name: "TopologyRole".into(), description: "CLOS role: super-spine, spine, or leaf".into(), example: "leaf".into() },
        TemplateVariable { name: r#"{% include "role" %}"#.into(), description: "Include role-specific template (e.g., arista-eos-spine)".into(), example: r#"{% include "role" %}"#.into() },
    ]))
}

/// Convert Go template syntax to Tera syntax (delegates to shared utility)
fn convert_go_template_to_tera(content: &str) -> String {
    crate::utils::convert_go_template_to_tera(content)
}
