use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::State,
    Json,
};

use super::helpers::*;
use crate::handlers::ApiError;
use crate::AppState;

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
        region_id: None,
        campus_id: None,
        datacenter_id: None,
    };
    if let Err(e) = state.store.create_topology(&topo_req).await {
        tracing::warn!("Failed to create topology: {}", e);
    }

    // ── Register devices ─────────────────────────────────────────
    let mut result_devices = Vec::new();
    let mut clos_device_ids: HashMap<String, i64> = HashMap::new();

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
            if let Ok(Some(existing_dev)) = state.store.get_device_by_mac(mac).await {
                let _ = state.store.delete_device(existing_dev.id).await;
            }

            let dev_req = crate::models::CreateDeviceRequest {
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
                device_type: None,
                hall_id: None,
                row_id: None,
                rack_id: None,
                rack_position: None,
            };
            match state.store.create_device(&dev_req).await {
                Ok(dev) => {
                    clos_device_ids.insert(mac.clone(), dev.id);
                }
                Err(e) => {
                    tracing::warn!("Failed to create device {}: {}", mac, e);
                }
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
        let device_id = match clos_device_ids.get(mac) {
            Some(id) => *id,
            None => continue,
        };
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
            (device_id, "Loopback".to_string(), node.loopback.to_string()),
            (device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (i, (peer_ip, peer_asn)) in peers.iter().enumerate() {
            entries.push((device_id, format!("Peer{}", i + 1), peer_ip.to_string()));
            entries.push((device_id, format!("Peer{}ASN", i + 1), peer_asn.to_string()));
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

pub(super) async fn teardown_clos_lab_inner(docker: &bollard::Docker, state: &Arc<AppState>) {
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
            if let Ok(Some(dev)) = state.store.get_device_by_mac(mac).await {
                let _ = state.store.delete_device(dev.id).await;
            }
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
