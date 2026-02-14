use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use super::ApiError;
use crate::AppState;

#[derive(Serialize)]
pub struct TestContainer {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub mac: String,
    pub ip: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Deserialize)]
pub struct SpawnRequest {
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub mac: String,
    #[serde(default)]
    pub vendor_class: String,
    #[serde(default)]
    pub user_class: String,
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub config_method: String,
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub topology_id: String,
    #[serde(default)]
    pub topology_role: String,
}

fn get_network_name() -> String {
    std::env::var("DOCKER_NETWORK").unwrap_or_else(|_| "ztp-server_ztp-net".to_string())
}

fn get_image_name() -> String {
    std::env::var("TEST_CLIENT_IMAGE").unwrap_or_else(|_| "ztp-server-test-client".to_string())
}

/// Generate a random MAC address with the locally administered bit set
fn generate_mac() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let mut mac = [0u8; 6];
    rng.fill(&mut mac);
    // Set the locally administered bit (bit 1 of first byte)
    mac[0] = (mac[0] | 0x02) & 0xfe;
    format!(
        "{:02x}:{:02x}:{:02x}:{:02x}:{:02x}:{:02x}",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]
    )
}

/// Check if this is a cEOS image
fn is_ceos_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("ceos") || lower.contains("ceosimage")
}

/// Check if this is an FRR image
fn is_frr_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("frr")
}

/// Check if this is a GoBGP image
fn is_gobgp_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("gobgp")
}

/// cEOS startup-config that mimics a real Arista switch out of the box.
/// Placeholders: {hostname}, {serial_number}
const CEOS_STARTUP_CONFIG: &str = r#"! device: {hostname}
! serial: {serial_number}
! boot system flash:/EOS.swi
!
hostname {hostname}
!
spanning-tree mode mstp
!
aaa authorization exec default local
!
no aaa root
!
username admin privilege 15 role network-admin secret 0 admin
!
interface Management0
   no shutdown
!
ip routing
!
management api http-commands
   no shutdown
!
management ssh
   idle-timeout 120
   authentication mode password
   no shutdown
!
end
"#;

/// Build a tar archive in memory containing files
fn build_tar(files: &[(&str, &[u8], u32)]) -> Result<Vec<u8>, String> {
    let mut archive = tar::Builder::new(Vec::new());
    for &(filename, content, mode) in files {
        let mut header = tar::Header::new_gnu();
        header.set_path(filename).map_err(|e| format!("tar path error: {}", e))?;
        header.set_size(content.len() as u64);
        header.set_mode(mode);
        header.set_cksum();
        archive.append(&header, content).map_err(|e| format!("tar append error: {}", e))?;
    }
    archive.finish().map_err(|e| format!("tar finish error: {}", e))?;
    archive.into_inner().map_err(|e| format!("tar inner error: {}", e))
}

/// List all test containers
pub async fn list_containers(
    _auth: crate::auth::AuthUser,
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Vec<TestContainer>>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let network_name = get_network_name();

    // Filter containers by label
    let mut filters = HashMap::new();
    filters.insert("label", vec!["ztp-test-client=true"]);

    let options = bollard::container::ListContainersOptions {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| ApiError::internal(format!("Failed to list containers: {}", e)))?;

    let mut result = Vec::new();
    for ctr in containers {
        let id = ctr.id.as_deref().unwrap_or("").to_string();
        let short_id = if id.len() >= 12 {
            id[..12].to_string()
        } else {
            id.clone()
        };

        // Inspect for more details
        let inspect = match docker.inspect_container(&id, None).await {
            Ok(info) => info,
            Err(_) => continue,
        };

        let mut mac = String::new();
        let mut ip = String::new();

        if let Some(net_settings) = &inspect.network_settings {
            if let Some(networks) = &net_settings.networks {
                if let Some(net) = networks.get(&network_name) {
                    mac = net.mac_address.clone().unwrap_or_default();
                    ip = net.ip_address.clone().unwrap_or_default();
                }
            }
        }

        let name = ctr
            .names
            .as_ref()
            .and_then(|n| n.first())
            .map(|n| n.trim_start_matches('/').to_string())
            .unwrap_or_default();

        let hostname = inspect
            .config
            .as_ref()
            .and_then(|c| c.hostname.clone())
            .unwrap_or_default();

        let status = ctr.state.unwrap_or_default();

        let created_at = ctr
            .created
            .map(|ts| {
                chrono::DateTime::from_timestamp(ts, 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        result.push(TestContainer {
            id: short_id,
            name,
            hostname,
            mac,
            ip,
            status,
            created_at,
        });
    }

    Ok(Json(result))
}

/// Spawn a new test container
pub async fn spawn_container(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    body: Option<Json<SpawnRequest>>,
) -> Result<(StatusCode, Json<TestContainer>), ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let req = body.map(|b| b.0).unwrap_or(SpawnRequest {
        hostname: String::new(),
        mac: String::new(),
        vendor_class: String::new(),
        user_class: String::new(),
        client_id: String::new(),
        config_method: String::new(),
        image: String::new(),
        topology_id: String::new(),
        topology_role: String::new(),
    });

    let network_name = get_network_name();

    // Use specified image or default test client
    let image_name = if req.image.is_empty() {
        get_image_name()
    } else {
        req.image.clone()
    };

    let ceos = is_ceos_image(&image_name);
    let frr = is_frr_image(&image_name);
    let gobgp = is_gobgp_image(&image_name);

    let mac = if req.mac.is_empty() {
        generate_mac()
    } else {
        req.mac
    };

    let timestamp = chrono::Utc::now().timestamp();
    let hostname = if req.hostname.is_empty() {
        if ceos {
            format!("ceos-{}", timestamp)
        } else if frr {
            format!("frr-{}", timestamp)
        } else if gobgp {
            format!("gobgp-{}", timestamp)
        } else {
            format!("test-device-{}", timestamp)
        }
    } else {
        req.hostname
    };
    let container_name = if ceos {
        format!("ztp-ceos-{}", timestamp)
    } else if frr {
        format!("ztp-frr-{}", timestamp)
    } else if gobgp {
        format!("ztp-gobgp-{}", timestamp)
    } else {
        format!("ztp-test-{}", timestamp)
    };

    // Build environment
    let mut env = if ceos {
        // cEOS-specific environment variables
        vec![
            "CEOS=1".to_string(),
            "container=docker".to_string(),
            "INTFTYPE=eth".to_string(),
            "ETBA=1".to_string(),
            "SKIP_STARTUP_CONFIG=false".to_string(),
            "AUTOCONFIGURE=dhcp".to_string(),
            "MAPETH0=1".to_string(),
        ]
    } else {
        let mut e = vec![format!("DEVICE_HOSTNAME={}", hostname)];
        if !req.vendor_class.is_empty() {
            e.push(format!("VENDOR_CLASS={}", req.vendor_class));
        } else if frr {
            e.push("VENDOR_CLASS=FRRouting".to_string());
        } else if gobgp {
            e.push("VENDOR_CLASS=GoBGP".to_string());
        } else {
            // Default vendor class so discovery has something to show
            e.push("VENDOR_CLASS=Cisco Systems, Inc.".to_string());
        }
        if !req.user_class.is_empty() {
            e.push(format!("USER_CLASS={}", req.user_class));
        } else if frr {
            e.push("USER_CLASS=FRR-9.1".to_string());
        } else if gobgp {
            e.push("USER_CLASS=GoBGP-3.28".to_string());
        } else {
            e.push(format!("USER_CLASS=C9300-48P"));
        }
        if !req.client_id.is_empty() {
            e.push(format!("CLIENT_ID={}", req.client_id));
        } else if frr {
            e.push(format!("CLIENT_ID=FRR-{:08}", timestamp % 100_000_000));
        } else if gobgp {
            e.push(format!("CLIENT_ID=GOBGP-{:08}", timestamp % 100_000_000));
        } else {
            // Generate a fake serial number
            e.push(format!("CLIENT_ID=FCW{:08}", timestamp % 100_000_000));
        }
        if !req.config_method.is_empty() {
            e.push(format!("CONFIG_METHOD={}", req.config_method));
        }
        e
    };

    // For cEOS, set vendor class if not already provided
    if ceos && req.vendor_class.is_empty() {
        env.push("VENDOR_CLASS=Arista Networks".to_string());
    }

    let mut labels = HashMap::new();
    labels.insert("ztp-test-client".to_string(), "true".to_string());
    if ceos {
        labels.insert("ztp-ceos".to_string(), "true".to_string());
    } else if frr {
        labels.insert("ztp-frr".to_string(), "true".to_string());
    } else if gobgp {
        labels.insert("ztp-gobgp".to_string(), "true".to_string());
    }

    // Build endpoint settings
    let mut endpoints = HashMap::new();
    endpoints.insert(
        network_name.clone(),
        bollard::models::EndpointSettings {
            mac_address: Some(mac.clone()),
            ..Default::default()
        },
    );

    // cEOS needs privileged mode + /dev/net/tun; FRR/GoBGP need NET_ADMIN + ip_forward;
    // test clients just need NET_ADMIN
    let host_config = if ceos {
        bollard::models::HostConfig {
            privileged: Some(true),
            devices: Some(vec![bollard::models::DeviceMapping {
                path_on_host: Some("/dev/net/tun".to_string()),
                path_in_container: Some("/dev/net/tun".to_string()),
                cgroup_permissions: Some("rwm".to_string()),
            }]),
            ..Default::default()
        }
    } else if frr || gobgp {
        let mut sysctls = HashMap::new();
        sysctls.insert("net.ipv4.ip_forward".to_string(), "1".to_string());
        bollard::models::HostConfig {
            cap_add: Some(vec!["NET_ADMIN".to_string(), "SYS_ADMIN".to_string()]),
            sysctls: Some(sysctls),
            ..Default::default()
        }
    } else {
        bollard::models::HostConfig {
            cap_add: Some(vec!["NET_ADMIN".to_string()]),
            ..Default::default()
        }
    };

    // cEOS images have no default CMD/entrypoint - need /sbin/init
    // cEOS: create /dev/console (mknod 5,1) before exec'ing /sbin/init as PID 1
    let (entrypoint, cmd) = if ceos {
        (
            Some(vec!["/bin/bash".to_string(), "-c".to_string(),
                "mknod -m 600 /dev/console c 5 1 2>/dev/null; exec /sbin/init \"$@\"".to_string(),
                "--".to_string()]),
            Some(vec![
                "systemd.setenv=INTFTYPE=eth".to_string(),
                "systemd.setenv=ETBA=1".to_string(),
                "systemd.setenv=CEOS=1".to_string(),
                "systemd.setenv=container=docker".to_string(),
            ]),
        )
    } else {
        (None, None)
    };

    let config = bollard::container::Config {
        image: Some(image_name),
        hostname: Some(hostname.clone()),
        env: Some(env),
        entrypoint,
        cmd,
        labels: Some(labels),
        host_config: Some(host_config),
        networking_config: Some(bollard::container::NetworkingConfig {
            endpoints_config: endpoints,
        }),
        ..Default::default()
    };

    let create_options = bollard::container::CreateContainerOptions {
        name: container_name.clone(),
        platform: None,
    };

    let resp = docker
        .create_container(Some(create_options), config)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to create container: {}", e)))?;

    // For cEOS, inject startup-config and modprobe wrapper before starting.
    // Docker Desktop's Linux VM doesn't have /lib/modules, so `modprobe tun`
    // fails during EosStage2 init, preventing SSH and other agents from starting.
    // We inject a wrapper that silently succeeds for known-safe modules.
    let serial_number = format!("SN-cEOS-{}", &resp.id[..resp.id.len().min(8)]);
    if ceos {
        let config_content = CEOS_STARTUP_CONFIG
            .replace("{hostname}", &hostname)
            .replace("{serial_number}", &serial_number);

        // Inject startup-config into /mnt/flash
        match build_tar(&[("startup-config", config_content.as_bytes(), 0o644)]) {
            Ok(tar_bytes) => {
                let options = bollard::container::UploadToContainerOptions {
                    path: "/mnt/flash".to_string(),
                    ..Default::default()
                };
                if let Err(e) = docker
                    .upload_to_container(&resp.id, Some(options), tar_bytes.into())
                    .await
                {
                    tracing::warn!("Failed to upload startup-config to cEOS: {}", e);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to build startup-config tar: {}", e);
            }
        }

        // Inject modprobe wrapper that always succeeds.
        // Docker Desktop's Linux VM has no /lib/modules, so `modprobe tun` fails
        // during EosStage2, preventing SSH and other EOS agents from starting.
        // Overwriting /sbin/modprobe before container start works because
        // upload_to_container modifies the stopped container's filesystem layer.
        let modprobe_wrapper = b"#!/bin/sh\nexit 0\n";
        match build_tar(&[("modprobe", modprobe_wrapper.as_slice(), 0o755)]) {
            Ok(tar_bytes) => {
                let options = bollard::container::UploadToContainerOptions {
                    path: "/sbin".to_string(),
                    ..Default::default()
                };
                if let Err(e) = docker
                    .upload_to_container(&resp.id, Some(options), tar_bytes.into())
                    .await
                {
                    tracing::warn!("Failed to upload modprobe wrapper to cEOS: {}", e);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to build modprobe wrapper tar: {}", e);
            }
        }
    }

    // Start the container
    if let Err(e) = docker
        .start_container::<String>(&resp.id, None)
        .await
    {
        // Clean up on failure
        let _ = docker
            .remove_container(
                &resp.id,
                Some(bollard::container::RemoveContainerOptions {
                    force: true,
                    ..Default::default()
                }),
            )
            .await;
        return Err(ApiError::internal(format!(
            "Failed to start container: {}",
            e
        )));
    }

    // Inspect to get IP
    let inspect = docker
        .inspect_container(&resp.id, None)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to inspect container: {}", e)))?;

    let mut ip = String::new();
    if let Some(net_settings) = &inspect.network_settings {
        if let Some(networks) = &net_settings.networks {
            if let Some(net) = networks.get(&network_name) {
                ip = net.ip_address.clone().unwrap_or_default();
            }
        }
    }

    // For cEOS containers, register directly in discovery since they don't do DHCP
    // (Docker assigns the IP statically before the container boots)
    if ceos && !ip.is_empty() {
        let lease = crate::models::Lease {
            expiry_time: chrono::Utc::now().timestamp() + 86400, // 24h synthetic lease
            mac: mac.clone(),
            ip: ip.clone(),
            hostname: hostname.clone(),
            client_id: None,
            vendor: Some("arista".to_string()),
            model: Some("cEOS-lab".to_string()),
            serial_number: Some(serial_number.clone()),
            vendor_class: Some("Arista Networks".to_string()),
            user_class: None,
            dhcp_client_id: None,
            requested_options: None,
            relay_address: None,
            circuit_id: None,
            remote_id: None,
            subscriber_id: None,
        };
        if let Err(e) = state.store.upsert_discovered_device(&lease).await {
            tracing::warn!("Failed to register cEOS in discovery: {}", e);
        }
    }

    // If topology_id is specified, create a device record with the topology assignment
    if !req.topology_id.is_empty() && !ip.is_empty() {
        let dev_req = crate::models::CreateDeviceRequest {
            id: None,
            mac: mac.clone(),
            ip: ip.clone(),
            hostname: hostname.clone(),
            vendor: if ceos { Some("arista".to_string()) } else { None },
            model: if ceos { Some("cEOS-lab".to_string()) } else { None },
            serial_number: if ceos { Some(serial_number.clone()) } else { None },
            config_template: if ceos { "arista-eos".to_string() } else { String::new() },
            ssh_user: None,
            ssh_pass: None,
            topology_id: Some(req.topology_id),
            topology_role: if req.topology_role.is_empty() { None } else { Some(req.topology_role) },
        };
        if let Err(e) = state.store.create_device(&dev_req).await {
            tracing::warn!("Failed to create device for topology: {}", e);
        }
    }

    let short_id = if resp.id.len() >= 12 {
        resp.id[..12].to_string()
    } else {
        resp.id.clone()
    };

    Ok((
        StatusCode::CREATED,
        Json(TestContainer {
            id: short_id,
            name: container_name,
            hostname,
            mac,
            ip,
            status: "running".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        }),
    ))
}

/// Start a stopped test container
pub async fn start_container(
    _auth: crate::auth::AuthUser,
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    docker
        .start_container::<String>(&id, None)
        .await
        .map_err(|e| ApiError::internal(format!("Failed to start container: {}", e)))?;

    Ok(Json(serde_json::json!({"message": "Container started"})))
}

/// Restart a test container
pub async fn restart_container(
    _auth: crate::auth::AuthUser,
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let options = bollard::container::RestartContainerOptions { t: 5 };
    docker
        .restart_container(&id, Some(options))
        .await
        .map_err(|e| ApiError::internal(format!("Failed to restart container: {}", e)))?;

    Ok(Json(serde_json::json!({"message": "Container restarted"})))
}

/// Remove a test container
pub async fn remove_container(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let network_name = get_network_name();

    // Inspect before removing to get the MAC address
    let mac = if let Ok(inspect) = docker.inspect_container(&id, None).await {
        inspect
            .network_settings
            .as_ref()
            .and_then(|ns| ns.networks.as_ref())
            .and_then(|nets| nets.get(&network_name))
            .and_then(|net| net.mac_address.clone())
            .unwrap_or_default()
    } else {
        String::new()
    };

    // Stop first (with timeout)
    let stop_options = bollard::container::StopContainerOptions { t: 5 };
    let _ = docker.stop_container(&id, Some(stop_options)).await;

    // Remove
    docker
        .remove_container(
            &id,
            Some(bollard::container::RemoveContainerOptions {
                force: true,
                ..Default::default()
            }),
        )
        .await
        .map_err(|e| ApiError::internal(format!("Failed to remove container: {}", e)))?;

    // Clean up discovered device record so it doesn't linger in discovery
    if !mac.is_empty() {
        if let Err(e) = state.store.delete_discovered_device(&mac).await {
            tracing::warn!("Failed to remove discovered device {}: {}", mac, e);
        }
    }

    Ok(Json(serde_json::json!({"message": "Container removed"})))
}

// ── CLOS Lab ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ClosLabRequest {
    #[serde(default)]
    pub image: String,
}

/// Response from the CLOS lab build endpoint
#[derive(Serialize)]
pub struct ClosLabResponse {
    pub topology_id: String,
    pub topology_name: String,
    pub devices: Vec<ClosLabDevice>,
    pub fabric_links: Vec<String>,
}

#[derive(Serialize)]
pub struct ClosLabDevice {
    pub hostname: String,
    pub role: String,
    pub mac: String,
    pub ip: String,
    pub container_name: String,
}

/// CLOS lab device definition
struct ClosNode {
    container_name: &'static str,
    hostname: &'static str,
    role: &'static str,
    loopback: &'static str,
    asn: u32,
}

const CLOS_NODES: &[ClosNode] = &[
    ClosNode { container_name: "clos-spine-1", hostname: "spine-1", role: "spine", loopback: "10.255.0.1", asn: 65000 },
    ClosNode { container_name: "clos-spine-2", hostname: "spine-2", role: "spine", loopback: "10.255.0.2", asn: 65000 },
    ClosNode { container_name: "clos-leaf-1",  hostname: "leaf-1",  role: "leaf",  loopback: "10.255.1.1", asn: 65001 },
    ClosNode { container_name: "clos-leaf-2",  hostname: "leaf-2",  role: "leaf",  loopback: "10.255.1.2", asn: 65001 },
];

/// Fabric link: network_name, subnet, container_a, ip_a, container_b, ip_b
struct ClosLink {
    net_name: &'static str,
    subnet: &'static str,
    container_a: &'static str,
    ip_a: &'static str,
    container_b: &'static str,
    ip_b: &'static str,
}

const CLOS_LINKS: &[ClosLink] = &[
    ClosLink { net_name: "clos-s1-l1", subnet: "10.0.1.0/29", container_a: "clos-spine-1", ip_a: "10.0.1.2", container_b: "clos-leaf-1", ip_b: "10.0.1.3" },
    ClosLink { net_name: "clos-s1-l2", subnet: "10.0.2.0/29", container_a: "clos-spine-1", ip_a: "10.0.2.2", container_b: "clos-leaf-2", ip_b: "10.0.2.3" },
    ClosLink { net_name: "clos-s2-l1", subnet: "10.0.3.0/29", container_a: "clos-spine-2", ip_a: "10.0.3.2", container_b: "clos-leaf-1", ip_b: "10.0.3.3" },
    ClosLink { net_name: "clos-s2-l2", subnet: "10.0.4.0/29", container_a: "clos-spine-2", ip_a: "10.0.4.2", container_b: "clos-leaf-2", ip_b: "10.0.4.3" },
];

const CLOS_TOPOLOGY_ID: &str = "dc1-fabric";
const CLOS_TOPOLOGY_NAME: &str = "DC1 Fabric";

/// Build a 2-spine / 2-leaf CLOS lab with cEOS or FRR containers
pub async fn build_clos_lab(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<ClosLabRequest>,
) -> Result<Json<ClosLabResponse>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let network_name = get_network_name();
    let image = if req.image.is_empty() {
        std::env::var("CEOS_IMAGE").unwrap_or_else(|_| "ceosimage:latest".to_string())
    } else {
        req.image
    };
    let use_frr = is_frr_image(&image);

    // ── Teardown existing lab first ──────────────────────────────
    teardown_clos_lab_inner(&docker, &state).await;

    // ── Create fabric networks ───────────────────────────────────
    for link in CLOS_LINKS {
        let ipam_config = if use_frr {
            // FRR needs /29 subnets with known IPs for explicit BGP peering
            Some(bollard::models::Ipam {
                config: Some(vec![bollard::models::IpamConfig {
                    subnet: Some(link.subnet.to_string()),
                    ..Default::default()
                }]),
                ..Default::default()
            })
        } else {
            None
        };
        let options = bollard::network::CreateNetworkOptions {
            name: link.net_name,
            internal: true,
            driver: "bridge",
            ipam: ipam_config.unwrap_or_default(),
            ..Default::default()
        };
        if let Err(e) = docker.create_network(options).await {
            tracing::warn!("Failed to create network {}: {} (may already exist)", link.net_name, e);
        }
    }

    // ── Create containers ────────────────────────────────────────
    let mut devices = Vec::new();
    let vendor_id = if use_frr { "frr" } else { "arista" };
    let model_name = if use_frr { "FRR-lab" } else { "cEOS-lab" };

    for node in CLOS_NODES {
        let mac = generate_mac();
        let serial = format!("SN-CLOS-{}", node.hostname);

        let mut labels = HashMap::new();
        labels.insert("ztp-test-client".to_string(), "true".to_string());
        labels.insert("ztp-clos".to_string(), CLOS_TOPOLOGY_ID.to_string());

        let mut endpoints = HashMap::new();
        endpoints.insert(
            network_name.clone(),
            bollard::models::EndpointSettings {
                mac_address: Some(mac.clone()),
                ..Default::default()
            },
        );

        let config = if use_frr {
            // FRR container config
            labels.insert("ztp-frr".to_string(), "true".to_string());

            let env = vec![
                format!("DEVICE_HOSTNAME={}", node.hostname),
            ];

            let mut sysctls = HashMap::new();
            sysctls.insert("net.ipv4.ip_forward".to_string(), "1".to_string());
            sysctls.insert("net.ipv6.conf.all.disable_ipv6".to_string(), "0".to_string());
            sysctls.insert("net.ipv6.conf.default.disable_ipv6".to_string(), "0".to_string());
            sysctls.insert("net.ipv6.conf.all.forwarding".to_string(), "1".to_string());

            let host_config = bollard::models::HostConfig {
                cap_add: Some(vec!["NET_ADMIN".to_string(), "SYS_ADMIN".to_string()]),
                privileged: Some(true),
                sysctls: Some(sysctls),
                ..Default::default()
            };

            bollard::container::Config {
                image: Some(image.clone()),
                hostname: Some(node.hostname.to_string()),
                env: Some(env),
                labels: Some(labels),
                host_config: Some(host_config),
                networking_config: Some(bollard::container::NetworkingConfig {
                    endpoints_config: endpoints,
                }),
                ..Default::default()
            }
        } else {
            // cEOS container config
            labels.insert("ztp-ceos".to_string(), "true".to_string());

            let env = vec![
                "CEOS=1".to_string(),
                "container=docker".to_string(),
                "INTFTYPE=eth".to_string(),
                "ETBA=1".to_string(),
                "SKIP_STARTUP_CONFIG=false".to_string(),
                "AUTOCONFIGURE=dhcp".to_string(),
                "MAPETH0=1".to_string(),
            ];

            let host_config = bollard::models::HostConfig {
                privileged: Some(true),
                devices: Some(vec![bollard::models::DeviceMapping {
                    path_on_host: Some("/dev/net/tun".to_string()),
                    path_in_container: Some("/dev/net/tun".to_string()),
                    cgroup_permissions: Some("rwm".to_string()),
                }]),
                ..Default::default()
            };

            bollard::container::Config {
                image: Some(image.clone()),
                hostname: Some(node.hostname.to_string()),
                env: Some(env),
                entrypoint: Some(vec![
                    "/bin/bash".to_string(), "-c".to_string(),
                    "mknod -m 600 /dev/console c 5 1 2>/dev/null; exec /sbin/init \"$@\"".to_string(),
                    "--".to_string(),
                ]),
                cmd: Some(vec![
                    "systemd.setenv=INTFTYPE=eth".to_string(),
                    "systemd.setenv=ETBA=1".to_string(),
                    "systemd.setenv=CEOS=1".to_string(),
                    "systemd.setenv=container=docker".to_string(),
                ]),
                labels: Some(labels),
                host_config: Some(host_config),
                networking_config: Some(bollard::container::NetworkingConfig {
                    endpoints_config: endpoints,
                }),
                ..Default::default()
            }
        };

        let create_options = bollard::container::CreateContainerOptions {
            name: node.container_name.to_string(),
            platform: None,
        };

        let resp = docker
            .create_container(Some(create_options), config)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create {}: {}", node.container_name, e)))?;

        // Inject startup-config for cEOS only
        if !use_frr {
            let config_content = CEOS_STARTUP_CONFIG
                .replace("{hostname}", node.hostname)
                .replace("{serial_number}", &serial);

            if let Ok(tar_bytes) = build_tar(&[("startup-config", config_content.as_bytes(), 0o644)]) {
                let options = bollard::container::UploadToContainerOptions {
                    path: "/mnt/flash".to_string(),
                    ..Default::default()
                };
                let _ = docker.upload_to_container(&resp.id, Some(options), tar_bytes.into()).await;
            }

            // Inject modprobe wrapper
            if let Ok(tar_bytes) = build_tar(&[("modprobe", b"#!/bin/sh\nexit 0\n".as_slice(), 0o755)]) {
                let options = bollard::container::UploadToContainerOptions {
                    path: "/sbin".to_string(),
                    ..Default::default()
                };
                let _ = docker.upload_to_container(&resp.id, Some(options), tar_bytes.into()).await;
            }
        }

        devices.push((node, mac, serial, resp.id));
    }

    // For cEOS: connect fabric links before starting (cEOS uses Management0, not eth0)
    if !use_frr {
        for link in CLOS_LINKS {
            for ctr in [link.container_a, link.container_b] {
                let config = bollard::network::ConnectNetworkOptions {
                    container: ctr,
                    ..Default::default()
                };
                if let Err(e) = docker.connect_network(link.net_name, config).await {
                    tracing::warn!("Failed to connect {} to {}: {}", ctr, link.net_name, e);
                }
            }
        }
    }

    // ── Start containers ─────────────────────────────────────────
    for (node, _, _, ref id) in &devices {
        if let Err(e) = docker.start_container::<String>(id, None).await {
            tracing::error!("Failed to start {}: {}", node.container_name, e);
        }
    }

    // For FRR: connect fabric links after starting so eth0 is always management
    // Use specific IPs from /29 subnets for explicit BGP peering
    if use_frr {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        for link in CLOS_LINKS {
            // Connect container_a with its specific IP
            let config_a = bollard::network::ConnectNetworkOptions {
                container: link.container_a,
                endpoint_config: bollard::models::EndpointSettings {
                    ipam_config: Some(bollard::models::EndpointIpamConfig {
                        ipv4_address: Some(link.ip_a.to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                ..Default::default()
            };
            if let Err(e) = docker.connect_network(link.net_name, config_a).await {
                tracing::warn!("Failed to connect {} to {}: {}", link.container_a, link.net_name, e);
            }
            // Connect container_b with its specific IP
            let config_b = bollard::network::ConnectNetworkOptions {
                container: link.container_b,
                endpoint_config: bollard::models::EndpointSettings {
                    ipam_config: Some(bollard::models::EndpointIpamConfig {
                        ipv4_address: Some(link.ip_b.to_string()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                ..Default::default()
            };
            if let Err(e) = docker.connect_network(link.net_name, config_b).await {
                tracing::warn!("Failed to connect {} to {}: {}", link.container_b, link.net_name, e);
            }
        }
    }

    // Wait for IPs to be assigned
    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

    // ── Create topology ──────────────────────────────────────────
    let _ = state.store.delete_topology(CLOS_TOPOLOGY_ID).await;
    let topo_req = crate::models::CreateTopologyRequest {
        id: CLOS_TOPOLOGY_ID.to_string(),
        name: CLOS_TOPOLOGY_NAME.to_string(),
        description: Some(format!("2-spine 2-leaf CLOS lab with {}", image)),
    };
    if let Err(e) = state.store.create_topology(&topo_req).await {
        tracing::warn!("Failed to create topology: {}", e);
    }

    // ── Register devices ─────────────────────────────────────────
    let mut result_devices = Vec::new();

    for (node, mac, serial, ref id) in &devices {
        // Get IP from container inspect
        let ip = match docker.inspect_container(id, None).await {
            Ok(inspect) => {
                inspect.network_settings
                    .as_ref()
                    .and_then(|ns| ns.networks.as_ref())
                    .and_then(|nets| nets.get(&network_name))
                    .and_then(|net| net.ip_address.clone())
                    .unwrap_or_default()
            }
            Err(_) => String::new(),
        };

        if !ip.is_empty() {
            // Delete existing device with this MAC if any
            let _ = state.store.delete_device(mac).await;

            let dev_req = crate::models::CreateDeviceRequest {
                id: None,
                mac: mac.clone(),
                ip: ip.clone(),
                hostname: node.hostname.to_string(),
                vendor: Some(vendor_id.to_string()),
                model: Some(model_name.to_string()),
                serial_number: Some(serial.clone()),
                config_template: String::new(),
                ssh_user: Some("admin".to_string()),
                ssh_pass: Some("admin".to_string()),
                topology_id: Some(CLOS_TOPOLOGY_ID.to_string()),
                topology_role: Some(node.role.to_string()),
            };
            if let Err(e) = state.store.create_device(&dev_req).await {
                tracing::warn!("Failed to create device {}: {}", mac, e);
            }

            // Also register in discovery
            let vendor_class = if use_frr { "FRRouting" } else { "Arista Networks" };
            let lease = crate::models::Lease {
                expiry_time: chrono::Utc::now().timestamp() + 86400,
                mac: mac.clone(),
                ip: ip.clone(),
                hostname: node.hostname.to_string(),
                client_id: None,
                vendor: Some(vendor_id.to_string()),
                model: Some(model_name.to_string()),
                serial_number: Some(serial.clone()),
                vendor_class: Some(vendor_class.to_string()),
                user_class: None,
                dhcp_client_id: None,
                requested_options: None,
                relay_address: None,
                circuit_id: None,
                remote_id: None,
                subscriber_id: None,
            };
            let _ = state.store.upsert_discovered_device(&lease).await;
        }

        result_devices.push(ClosLabDevice {
            hostname: node.hostname.to_string(),
            role: node.role.to_string(),
            mac: mac.clone(),
            ip,
            container_name: node.container_name.to_string(),
        });
    }

    let fabric_links: Vec<String> = CLOS_LINKS.iter()
        .map(|link| format!("{} ({}) <-> {} ({}) [{}]", link.container_a, link.ip_a, link.container_b, link.ip_b, link.net_name))
        .collect();

    // Set device variables for each CLOS node (Loopback, ASN, peer info)
    // These variables are used by FRR role templates for BGP configuration
    for (node, mac, _serial, _id) in &devices {
        // Collect peer info for this node
        let mut peers: Vec<(&str, u32)> = Vec::new();
        for link in CLOS_LINKS {
            if link.container_a == node.container_name {
                let peer_node = CLOS_NODES.iter().find(|n| n.container_name == link.container_b);
                if let Some(pn) = peer_node {
                    peers.push((link.ip_b, pn.asn));
                }
            } else if link.container_b == node.container_name {
                let peer_node = CLOS_NODES.iter().find(|n| n.container_name == link.container_a);
                if let Some(pn) = peer_node {
                    peers.push((link.ip_a, pn.asn));
                }
            }
        }

        let mut entries = vec![
            (mac.clone(), "Loopback".to_string(), node.loopback.to_string()),
            (mac.clone(), "ASN".to_string(), node.asn.to_string()),
        ];
        for (i, (peer_ip, peer_asn)) in peers.iter().enumerate() {
            entries.push((mac.clone(), format!("Peer{}", i + 1), peer_ip.to_string()));
            entries.push((mac.clone(), format!("Peer{}ASN", i + 1), peer_asn.to_string()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set device variables for {}: {}", node.hostname, e);
        }
    }

    // For FRR: configure BGP via docker exec after containers and links are ready
    // This provides immediate BGP peering; templates can also deploy the same config
    if use_frr {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        configure_frr_bgp(&docker).await;
    }

    // Trigger config generation so devices get their DHCP/TFTP configs
    if let Err(e) = state.config_manager.generate_config().await {
        tracing::warn!("Failed to generate config after CLOS lab build: {}", e);
    }

    Ok(Json(ClosLabResponse {
        topology_id: CLOS_TOPOLOGY_ID.to_string(),
        topology_name: CLOS_TOPOLOGY_NAME.to_string(),
        devices: result_devices,
        fabric_links,
    }))
}

/// Configure BGP on all FRR CLOS containers via docker exec
async fn configure_frr_bgp(docker: &bollard::Docker) {
    for node in CLOS_NODES {
        // Collect this node's peer IPs and their remote AS numbers
        let mut peers: Vec<(&str, u32)> = Vec::new(); // (peer_ip, peer_asn)
        for link in CLOS_LINKS {
            if link.container_a == node.container_name {
                // This node is container_a, peer is container_b
                let peer_node = CLOS_NODES.iter().find(|n| n.container_name == link.container_b);
                if let Some(pn) = peer_node {
                    peers.push((link.ip_b, pn.asn));
                }
            } else if link.container_b == node.container_name {
                // This node is container_b, peer is container_a
                let peer_node = CLOS_NODES.iter().find(|n| n.container_name == link.container_a);
                if let Some(pn) = peer_node {
                    peers.push((link.ip_a, pn.asn));
                }
            }
        }

        // Build vtysh commands
        let mut cmds = vec![
            "configure terminal".to_string(),
            format!("interface lo"),
            format!(" ip address {}/32", node.loopback),
            "exit".to_string(),
            format!("router bgp {}", node.asn),
            format!(" bgp router-id {}", node.loopback),
            " no bgp ebgp-requires-policy".to_string(),
            " no bgp network import-check".to_string(),
        ];
        for (peer_ip, peer_asn) in &peers {
            cmds.push(format!(" neighbor {} remote-as {}", peer_ip, peer_asn));
        }
        cmds.push(" address-family ipv4 unicast".to_string());
        cmds.push("  redistribute connected".to_string());
        cmds.push(" exit-address-family".to_string());
        cmds.push("end".to_string());
        cmds.push("write memory".to_string());

        // Execute via docker exec: vtysh -c "cmd1" -c "cmd2" ...
        let mut exec_cmd = vec!["vtysh".to_string()];
        for cmd in &cmds {
            exec_cmd.push("-c".to_string());
            exec_cmd.push(cmd.clone());
        }

        let exec_config = bollard::exec::CreateExecOptions {
            cmd: Some(exec_cmd),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };
        match docker.create_exec(node.container_name, exec_config).await {
            Ok(exec) => {
                let start_config = bollard::exec::StartExecOptions { detach: false, ..Default::default() };
                match docker.start_exec(&exec.id, Some(start_config)).await {
                    Ok(_) => tracing::info!("Configured BGP on {} (AS {})", node.hostname, node.asn),
                    Err(e) => tracing::warn!("Failed to start exec on {}: {}", node.hostname, e),
                }
            }
            Err(e) => tracing::warn!("Failed to create exec on {}: {}", node.hostname, e),
        }
    }
}

/// Tear down the CLOS lab
pub async fn teardown_clos_lab(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    teardown_clos_lab_inner(&docker, &state).await;

    Ok(Json(serde_json::json!({"message": "CLOS lab torn down"})))
}

async fn teardown_clos_lab_inner(docker: &bollard::Docker, state: &Arc<AppState>) {
    let network_name = get_network_name();

    // Stop and remove containers
    for node in CLOS_NODES {
        // Get MAC before removing (for device cleanup)
        let mac = docker.inspect_container(node.container_name, None).await.ok()
            .and_then(|i| i.network_settings)
            .and_then(|ns| ns.networks)
            .and_then(|nets| nets.get(&network_name).cloned())
            .and_then(|net| net.mac_address);

        let stop_opts = bollard::container::StopContainerOptions { t: 3 };
        let _ = docker.stop_container(node.container_name, Some(stop_opts)).await;
        let remove_opts = bollard::container::RemoveContainerOptions { force: true, ..Default::default() };
        let _ = docker.remove_container(node.container_name, Some(remove_opts)).await;

        // Clean up device and discovery records
        if let Some(ref mac) = mac {
            let _ = state.store.delete_device(mac).await;
            let _ = state.store.delete_discovered_device(mac).await;
        }
    }

    // Remove fabric networks
    for link in CLOS_LINKS {
        let _ = docker.remove_network(link.net_name).await;
    }

    // Delete topology
    let _ = state.store.delete_topology(CLOS_TOPOLOGY_ID).await;
}

// ─────────────────────────────────────────────────────────────────────────────
// Virtual CLOS topology — 4 spines, 16 leaves — device records only, no Docker
// ─────────────────────────────────────────────────────────────────────────────

const VIRTUAL_CLOS_TOPOLOGY_ID: &str = "dc1-virtual";
const VIRTUAL_CLOS_TOPOLOGY_NAME: &str = "DC1 Virtual Fabric";
const VIRTUAL_CLOS_P2P_CIDR: &str = "10.1.0.0/16";
const VIRTUAL_CLOS_LOOPBACK_CIDR: &str = "10.255.0.0/16";
const VIRTUAL_CLOS_P2P_PARENT_CIDR: &str = "10.0.0.0/8";

const VIRTUAL_SPINE_COUNT: usize = 4;
const VIRTUAL_LEAF_COUNT: usize = 16;

/// Generate a MAC with Arista OUI (00:1C:73) + random lower 3 bytes
fn generate_arista_mac() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let b3: u8 = rng.gen();
    let b4: u8 = rng.gen();
    let b5: u8 = rng.gen();
    format!("00:1c:73:{:02x}:{:02x}:{:02x}", b3, b4, b5)
}

/// Build a 4-spine / 16-leaf virtual CLOS topology (device records only)
pub async fn build_virtual_clos(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ClosLabResponse>, ApiError> {
    // Teardown any existing virtual CLOS first
    teardown_virtual_clos_inner(&state).await;

    // Create topology
    let topo_req = crate::models::CreateTopologyRequest {
        id: VIRTUAL_CLOS_TOPOLOGY_ID.to_string(),
        name: VIRTUAL_CLOS_TOPOLOGY_NAME.to_string(),
        description: Some("4-spine / 16-leaf Arista virtual fabric".to_string()),
    };
    if let Err(e) = state.store.create_topology(&topo_req).await {
        tracing::warn!("Failed to create virtual topology: {}", e);
    }

    // Build node list: 4 spines + 16 leaves
    struct VNode {
        hostname: String,
        role: &'static str,
        loopback: String,
        asn: u32,
        model: &'static str,
        mgmt_ip: String,
    }

    let mut nodes: Vec<VNode> = Vec::new();

    // Spines: 7050CX3-32S (bigger — 32x QSFP28 100G)
    for i in 1..=VIRTUAL_SPINE_COUNT {
        nodes.push(VNode {
            hostname: format!("spine-{}", i),
            role: "spine",
            loopback: format!("10.255.0.{}", i),
            asn: 65000,
            model: "7050CX3-32S",
            mgmt_ip: format!("172.20.0.{}", 10 + i),
        });
    }

    // Leaves: 7050SX3-48YC8 (48x SFP28 25G + 8x QSFP28 100G)
    for i in 1..=VIRTUAL_LEAF_COUNT {
        nodes.push(VNode {
            hostname: format!("leaf-{}", i),
            role: "leaf",
            loopback: format!("10.255.1.{}", i),
            asn: 65000 + i as u32,
            model: "7050SX3-48YC8",
            mgmt_ip: format!("172.20.1.{}", 10 + i),
        });
    }

    // Create device records + collect results
    let mut result_devices = Vec::new();
    let mut created_ids: Vec<(String, VNode)> = Vec::new();

    for node in nodes {
        let mac = generate_arista_mac();
        let serial = format!("SN-VCLOS-{}", node.hostname);

        let dev_req = crate::models::CreateDeviceRequest {
            id: None,
            mac: mac.clone(),
            ip: node.mgmt_ip.clone(),
            hostname: node.hostname.clone(),
            vendor: Some("arista".to_string()),
            model: Some(node.model.to_string()),
            serial_number: Some(serial),
            config_template: "arista-eos".to_string(),
            ssh_user: Some("admin".to_string()),
            ssh_pass: Some("admin".to_string()),
            topology_id: Some(VIRTUAL_CLOS_TOPOLOGY_ID.to_string()),
            topology_role: Some(node.role.to_string()),
        };

        match state.store.create_device(&dev_req).await {
            Ok(dev) => {
                result_devices.push(ClosLabDevice {
                    hostname: node.hostname.clone(),
                    role: node.role.to_string(),
                    mac: mac.clone(),
                    ip: node.mgmt_ip.clone(),
                    container_name: String::new(),
                });
                created_ids.push((dev.id, node));
            }
            Err(e) => {
                tracing::warn!("Failed to create virtual device {}: {}", node.hostname, e);
            }
        }
    }

    // Look up parent supernet by CIDR (needed for both pools)
    let parent = state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_P2P_PARENT_CIDR, None).await
        .map_err(|e| ApiError::internal(format!("Failed to find parent supernet: {}", e)))?
        .ok_or_else(|| ApiError::bad_request(&format!(
            "Parent supernet {} must exist before building CLOS fabric", VIRTUAL_CLOS_P2P_PARENT_CIDR
        )))?;

    // Ensure P2P prefix pool exists in IPAM (10.1.0.0/16 under parent supernet)
    let p2p_pool = match state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_P2P_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: VIRTUAL_CLOS_P2P_CIDR.to_string(),
                description: Some("Fabric P2P link pool".to_string()),
                status: "active".to_string(),
                is_supernet: false,
                role_ids: vec!["pool".to_string()],
                parent_id: Some(parent.id),
                datacenter_id: None,
                vlan_id: None,
                vrf_id: None,
            };
            state.store.create_ipam_prefix(&req).await
                .map_err(|e| ApiError::internal(format!("Failed to create P2P pool in IPAM: {}", e)))?
        }
    };

    // Ensure Loopback prefix pool exists in IPAM (10.255.0.0/16 under parent supernet)
    let loopback_pool = match state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_LOOPBACK_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: VIRTUAL_CLOS_LOOPBACK_CIDR.to_string(),
                description: Some("Loopback address pool".to_string()),
                status: "active".to_string(),
                is_supernet: false,
                role_ids: vec!["pool".to_string()],
                parent_id: Some(parent.id),
                datacenter_id: None,
                vlan_id: None,
                vrf_id: None,
            };
            state.store.create_ipam_prefix(&req).await
                .map_err(|e| ApiError::internal(format!("Failed to create loopback pool in IPAM: {}", e)))?
        }
    };

    // Reserve loopback IPs in IPAM for each device
    for (device_id, node) in &created_ids {
        let loopback_ip_id = format!("ip-lo-{}", node.hostname);
        let lo_req = crate::models::CreateIpamIpAddressRequest {
            id: loopback_ip_id,
            address: node.loopback.clone(),
            prefix_id: loopback_pool.id,
            description: Some(format!("{} Loopback0", node.hostname)),
            status: "active".to_string(),
            role_ids: vec![],
            dns_name: Some(format!("{}.lo", node.hostname)),
            device_id: Some(device_id.clone()),
            interface_name: Some("Loopback0".to_string()),
            vrf_id: None,
        };
        if let Err(e) = state.store.create_ipam_ip_address(&lo_req).await {
            tracing::warn!("Failed to reserve loopback {} for {}: {}", node.loopback, node.hostname, e);
        }
    }

    // Build fabric links using IPAM-allocated /31 subnets
    // Each spine-leaf pair gets 2 point-to-point /31 links
    // Spine side = network address (even), Leaf side = broadcast address (odd)
    let spines: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "spine").collect();
    let leaves: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "leaf").collect();

    // spine_vars[spine_idx] = Vec of (peer_idx, peer_ip, peer_asn, peer_name, local_addr)
    let mut spine_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); spines.len()];
    let mut leaf_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); leaves.len()];
    let mut fabric_links = Vec::new();

    for (si, (spine_device_id, spine)) in spines.iter().enumerate() {
        for (li, (leaf_device_id, leaf)) in leaves.iter().enumerate() {
            for link in 0..2u32 {
                // Allocate a /31 from IPAM
                let alloc_req = crate::models::NextAvailablePrefixRequest {
                    prefix_length: 31,
                    description: Some(format!("{} <-> {} link {}", spine.hostname, leaf.hostname, link + 1)),
                    status: "active".to_string(),
                    datacenter_id: None,
                };
                let subnet = state.store.next_available_ipam_prefix(p2p_pool.id, &alloc_req).await
                    .map_err(|e| ApiError::internal(format!("Failed to allocate /31: {}", e)))?;

                let net = subnet.network_int as u32;
                let spine_ip = crate::utils::u32_to_ipv4(net);       // even (network)
                let leaf_ip = crate::utils::u32_to_ipv4(net + 1);    // odd (broadcast)

                // Reserve spine-side IP address in IPAM
                let spine_if_name = format!("Ethernet{}", li * 2 + link as usize + 1);
                let spine_ip_id = format!("ip-{}", spine_ip.replace('.', "-"));
                let spine_ip_req = crate::models::CreateIpamIpAddressRequest {
                    id: spine_ip_id,
                    address: spine_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", spine.hostname, spine_if_name, leaf.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(spine_device_id.clone()),
                    interface_name: Some(spine_if_name),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&spine_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", spine_ip, spine.hostname, e);
                }

                // Reserve leaf-side IP address in IPAM
                let leaf_if_name = format!("Ethernet{}", si * 2 + link as usize + 1);
                let leaf_ip_id = format!("ip-{}", leaf_ip.replace('.', "-"));
                let leaf_ip_req = crate::models::CreateIpamIpAddressRequest {
                    id: leaf_ip_id,
                    address: leaf_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", leaf.hostname, leaf_if_name, spine.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(leaf_device_id.clone()),
                    interface_name: Some(leaf_if_name),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&leaf_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", leaf_ip, leaf.hostname, e);
                }

                // Spine peer index: leaf_idx * 2 + link + 1
                let spine_peer_idx = li * 2 + link as usize + 1;
                spine_vars[si].push((spine_peer_idx, leaf_ip.clone(), leaf.asn.to_string(), leaf.hostname.clone(), spine_ip.clone()));

                // Leaf peer index: spine_idx * 2 + link + 1
                let leaf_peer_idx = si * 2 + link as usize + 1;
                leaf_vars[li].push((leaf_peer_idx, spine_ip.clone(), spine.asn.to_string(), spine.hostname.clone(), leaf_ip.clone()));

                fabric_links.push(format!(
                    "{} ({}) <-> {} ({}) [{}]",
                    spine.hostname, spine_ip, leaf.hostname, leaf_ip, subnet.prefix
                ));
            }
        }
    }

    // Set variables for spines
    for (si, (device_id, node)) in spines.iter().enumerate() {
        let mut entries = vec![
            (device_id.clone(), "Loopback".to_string(), node.loopback.clone()),
            (device_id.clone(), "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &spine_vars[si] {
            entries.push((device_id.clone(), format!("Peer{}", idx), peer_ip.clone()));
            entries.push((device_id.clone(), format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((device_id.clone(), format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((device_id.clone(), format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Set variables for leaves
    for (li, (device_id, node)) in leaves.iter().enumerate() {
        let mut entries = vec![
            (device_id.clone(), "Loopback".to_string(), node.loopback.clone()),
            (device_id.clone(), "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &leaf_vars[li] {
            entries.push((device_id.clone(), format!("Peer{}", idx), peer_ip.clone()));
            entries.push((device_id.clone(), format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((device_id.clone(), format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((device_id.clone(), format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Generate configs
    if let Err(e) = state.config_manager.generate_config().await {
        tracing::warn!("Failed to generate config after virtual CLOS build: {}", e);
    }

    Ok(Json(ClosLabResponse {
        topology_id: VIRTUAL_CLOS_TOPOLOGY_ID.to_string(),
        topology_name: VIRTUAL_CLOS_TOPOLOGY_NAME.to_string(),
        devices: result_devices,
        fabric_links,
    }))
}

/// Teardown virtual CLOS topology
pub async fn teardown_virtual_clos(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    teardown_virtual_clos_inner(&state).await;
    Ok(StatusCode::NO_CONTENT)
}

async fn teardown_virtual_clos_inner(state: &Arc<AppState>) {
    let deleted = state.store.delete_devices_by_topology(VIRTUAL_CLOS_TOPOLOGY_ID).await.unwrap_or(0);
    if deleted > 0 {
        tracing::info!("Deleted {} virtual CLOS devices", deleted);
    }
    let _ = state.store.delete_topology(VIRTUAL_CLOS_TOPOLOGY_ID).await;
}
