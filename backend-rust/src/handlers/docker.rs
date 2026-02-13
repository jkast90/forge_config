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
}

const CLOS_NODES: &[ClosNode] = &[
    ClosNode { container_name: "clos-spine-1", hostname: "spine-1", role: "spine" },
    ClosNode { container_name: "clos-spine-2", hostname: "spine-2", role: "spine" },
    ClosNode { container_name: "clos-leaf-1",  hostname: "leaf-1",  role: "leaf" },
    ClosNode { container_name: "clos-leaf-2",  hostname: "leaf-2",  role: "leaf" },
];

/// Fabric link: (network_name, container_a, container_b)
const CLOS_LINKS: &[(&str, &str, &str)] = &[
    ("clos-s1-l1", "clos-spine-1", "clos-leaf-1"),
    ("clos-s1-l2", "clos-spine-1", "clos-leaf-2"),
    ("clos-s2-l1", "clos-spine-2", "clos-leaf-1"),
    ("clos-s2-l2", "clos-spine-2", "clos-leaf-2"),
];

const CLOS_TOPOLOGY_ID: &str = "dc1-fabric";
const CLOS_TOPOLOGY_NAME: &str = "DC1 Fabric";

/// Build a 2-spine / 2-leaf CLOS lab with cEOS containers
pub async fn build_clos_lab(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<ClosLabResponse>, ApiError> {
    let docker = bollard::Docker::connect_with_socket_defaults()
        .map_err(|e| ApiError::internal(format!("Docker not available: {}", e)))?;

    let network_name = get_network_name();
    let image = std::env::var("CEOS_IMAGE").unwrap_or_else(|_| "ceosimage:latest".to_string());

    // ── Teardown existing lab first ──────────────────────────────
    teardown_clos_lab_inner(&docker, &state).await;

    // ── Create fabric networks ───────────────────────────────────
    for &(net_name, _, _) in CLOS_LINKS {
        let options = bollard::network::CreateNetworkOptions {
            name: net_name,
            internal: true,
            driver: "bridge",
            ..Default::default()
        };
        if let Err(e) = docker.create_network(options).await {
            tracing::warn!("Failed to create network {}: {} (may already exist)", net_name, e);
        }
    }

    // ── Create containers ────────────────────────────────────────
    let mut devices = Vec::new();

    for node in CLOS_NODES {
        let mac = generate_mac();
        let serial = format!("SN-CLOS-{}", node.hostname);

        // Build cEOS container config
        let env = vec![
            "CEOS=1".to_string(),
            "container=docker".to_string(),
            "INTFTYPE=eth".to_string(),
            "ETBA=1".to_string(),
            "SKIP_STARTUP_CONFIG=false".to_string(),
            "AUTOCONFIGURE=dhcp".to_string(),
            "MAPETH0=1".to_string(),
        ];

        let mut labels = HashMap::new();
        labels.insert("ztp-test-client".to_string(), "true".to_string());
        labels.insert("ztp-ceos".to_string(), "true".to_string());
        labels.insert("ztp-clos".to_string(), CLOS_TOPOLOGY_ID.to_string());

        let mut endpoints = HashMap::new();
        endpoints.insert(
            network_name.clone(),
            bollard::models::EndpointSettings {
                mac_address: Some(mac.clone()),
                ..Default::default()
            },
        );

        let host_config = bollard::models::HostConfig {
            privileged: Some(true),
            devices: Some(vec![bollard::models::DeviceMapping {
                path_on_host: Some("/dev/net/tun".to_string()),
                path_in_container: Some("/dev/net/tun".to_string()),
                cgroup_permissions: Some("rwm".to_string()),
            }]),
            ..Default::default()
        };

        let config = bollard::container::Config {
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
        };

        let create_options = bollard::container::CreateContainerOptions {
            name: node.container_name.to_string(),
            platform: None,
        };

        let resp = docker
            .create_container(Some(create_options), config)
            .await
            .map_err(|e| ApiError::internal(format!("Failed to create {}: {}", node.container_name, e)))?;

        // Inject startup-config
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

        devices.push((node, mac, serial, resp.id));
    }

    // ── Connect fabric links (before starting) ───────────────────
    for &(net_name, container_a, container_b) in CLOS_LINKS {
        for ctr in [container_a, container_b] {
            let config = bollard::network::ConnectNetworkOptions {
                container: ctr,
                ..Default::default()
            };
            if let Err(e) = docker.connect_network(net_name, config).await {
                tracing::warn!("Failed to connect {} to {}: {}", ctr, net_name, e);
            }
        }
    }

    // ── Start containers ─────────────────────────────────────────
    for (node, _, _, ref id) in &devices {
        if let Err(e) = docker.start_container::<String>(id, None).await {
            tracing::error!("Failed to start {}: {}", node.container_name, e);
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
                mac: mac.clone(),
                ip: ip.clone(),
                hostname: node.hostname.to_string(),
                vendor: Some("arista".to_string()),
                model: Some("cEOS-lab".to_string()),
                serial_number: Some(serial.clone()),
                config_template: "arista-eos".to_string(),
                ssh_user: None,
                ssh_pass: None,
                topology_id: Some(CLOS_TOPOLOGY_ID.to_string()),
                topology_role: Some(node.role.to_string()),
            };
            if let Err(e) = state.store.create_device(&dev_req).await {
                tracing::warn!("Failed to create device {}: {}", mac, e);
            }

            // Also register in discovery
            let lease = crate::models::Lease {
                expiry_time: chrono::Utc::now().timestamp() + 86400,
                mac: mac.clone(),
                ip: ip.clone(),
                hostname: node.hostname.to_string(),
                client_id: None,
                vendor: Some("arista".to_string()),
                model: Some("cEOS-lab".to_string()),
                serial_number: Some(serial.clone()),
                vendor_class: Some("Arista Networks".to_string()),
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
        .map(|&(net, a, b)| format!("{} <-> {} ({})", a, b, net))
        .collect();

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
    for &(net_name, _, _) in CLOS_LINKS {
        let _ = docker.remove_network(net_name).await;
    }

    // Delete topology
    let _ = state.store.delete_topology(CLOS_TOPOLOGY_ID).await;
}
