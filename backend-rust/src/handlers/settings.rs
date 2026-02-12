use axum::{
    extract::State,
    Json,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

use super::{trigger_reload, ApiError, MessageResponse};

/// Get the global settings
pub async fn get_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Settings>, ApiError> {
    let settings = state.store.get_settings().await?;
    Ok(Json(settings))
}

/// Update the global settings
pub async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(settings): Json<Settings>,
) -> Result<Json<Settings>, ApiError> {
    state.store.update_settings(&settings).await?;
    trigger_reload(&state).await;
    Ok(Json(settings))
}

/// Trigger a manual config regeneration
pub async fn reload_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<MessageResponse>, ApiError> {
    state
        .trigger_config_reload()
        .await
        .map_err(|e| ApiError::internal(format!("Failed to reload config: {}", e)))?;

    Ok(MessageResponse::new("configuration reloaded"))
}

/// Get local network interfaces and their IP addresses
pub async fn get_local_addresses() -> Result<Json<Vec<NetworkInterface>>, ApiError> {
    let interfaces = get_network_interfaces().await?;
    Ok(Json(interfaces))
}

async fn get_network_interfaces() -> anyhow::Result<Vec<NetworkInterface>> {
    let mut result = Vec::new();

    // Use pnet or similar crate for cross-platform network interface enumeration
    // For now, we'll use a simple approach that works on Linux/macOS

    #[cfg(unix)]
    {
        use tokio::process::Command;

        // Try ip command first (Linux)
        let output = Command::new("ip")
            .args(["addr", "show"])
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                result = parse_ip_addr_output(&stdout);
                if !result.is_empty() {
                    return Ok(result);
                }
            }
        }

        // Fallback to ifconfig (macOS/BSD)
        let output = Command::new("ifconfig")
            .output()
            .await;

        if let Ok(output) = output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                result = parse_ifconfig_output(&stdout);
            }
        }
    }

    Ok(result)
}

fn parse_ip_addr_output(output: &str) -> Vec<NetworkInterface> {
    let mut interfaces = Vec::new();
    let mut current_interface: Option<NetworkInterface> = None;

    for line in output.lines() {
        // New interface starts with a number
        if let Some(idx) = line.find(':') {
            if line.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                // Save previous interface
                if let Some(iface) = current_interface.take() {
                    if iface.is_up && !iface.addresses.is_empty() {
                        interfaces.push(iface);
                    }
                }

                // Parse new interface name
                let after_colon = &line[idx + 1..];
                let name = after_colon
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .trim_end_matches(':');

                let is_up = line.contains("UP");
                let is_loopback = line.contains("LOOPBACK");

                current_interface = Some(NetworkInterface {
                    name: name.to_string(),
                    addresses: Vec::new(),
                    is_up,
                    is_loopback,
                });
            }
        }

        // Parse inet/inet6 addresses
        let trimmed = line.trim();
        if let Some(iface) = current_interface.as_mut() {
            if trimmed.starts_with("inet ") || trimmed.starts_with("inet6 ") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    iface.addresses.push(parts[1].to_string());
                }
            }
        }
    }

    // Don't forget the last interface
    if let Some(iface) = current_interface {
        if iface.is_up && !iface.addresses.is_empty() {
            interfaces.push(iface);
        }
    }

    interfaces
}

fn parse_ifconfig_output(output: &str) -> Vec<NetworkInterface> {
    let mut interfaces = Vec::new();
    let mut current_interface: Option<NetworkInterface> = None;

    for line in output.lines() {
        // New interface starts without whitespace
        if !line.starts_with('\t') && !line.starts_with(' ') && !line.is_empty() {
            // Save previous interface
            if let Some(iface) = current_interface.take() {
                if iface.is_up && !iface.addresses.is_empty() {
                    interfaces.push(iface);
                }
            }

            // Parse interface name (first word before colon or space)
            let name = line
                .split(&[':', ' '][..])
                .next()
                .unwrap_or("")
                .to_string();

            let is_up = line.contains("UP");
            let is_loopback = line.contains("LOOPBACK");

            current_interface = Some(NetworkInterface {
                name,
                addresses: Vec::new(),
                is_up,
                is_loopback,
            });
        }

        // Parse inet/inet6 addresses
        let trimmed = line.trim();
        if let Some(iface) = current_interface.as_mut() {
            if trimmed.starts_with("inet ") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    iface.addresses.push(parts[1].to_string());
                }
            } else if trimmed.starts_with("inet6 ") {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    // Remove scope id if present
                    let addr = parts[1].split('%').next().unwrap_or(parts[1]);
                    iface.addresses.push(addr.to_string());
                }
            }
        }
    }

    // Don't forget the last interface
    if let Some(iface) = current_interface {
        if iface.is_up && !iface.addresses.is_empty() {
            interfaces.push(iface);
        }
    }

    interfaces
}
