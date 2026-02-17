use std::collections::HashMap;
use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};

use crate::handlers::ApiError;
use crate::AppState;

use super::helpers::*;

struct VNode {
    hostname: String,
    role: String,
    loopback: String,
    asn: u32,
    model: String,
    mgmt_ip: String,
    hall_id: Option<i64>,
    row_id: Option<i64>,
    rack_id: Option<i64>,
    rack_position: Option<i32>,
    device_type: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchical (3-tier) topology builder — core / distribution / access
// ─────────────────────────────────────────────────────────────────────────────

const THREE_TIER_TOPOLOGY_ID: &str = "dc1-hierarchical";
const THREE_TIER_TOPOLOGY_NAME: &str = "DC1 Hierarchical Fabric";
const THREE_TIER_P2P_CIDR: &str = "10.2.0.0/16";
const THREE_TIER_LOOPBACK_CIDR: &str = "10.254.0.0/16";
const THREE_TIER_P2P_PARENT_CIDR: &str = "10.0.0.0/8";

/// Resolve a hostname from the pattern, substituting variables.
fn resolve_hostname(pattern: &str, datacenter: &str, region: &str, hall: &str, role: &str, index: usize) -> String {
    let result = pattern
        .replace("$region", region)
        .replace("$datacenter", datacenter)
        .replace("$hall", hall)
        .replace("$role", role)
        .replace('#', &index.to_string());
    // Clean leading/trailing hyphens and collapse double hyphens from empty variables
    let mut cleaned = result.trim_matches('-').to_string();
    while cleaned.contains("--") {
        cleaned = cleaned.replace("--", "-");
    }
    cleaned
}

/// Simulated /31 IP helper for preview: given a base network (as u32) and a link index,
/// returns (even_ip, odd_ip, subnet_cidr).
fn sim_ip(base: u32, link_index: usize) -> (String, String, String) {
    let net = base + (link_index as u32 * 2);
    let a = format!(
        "{}.{}.{}.{}",
        (net >> 24) & 0xff,
        (net >> 16) & 0xff,
        (net >> 8) & 0xff,
        net & 0xff
    );
    let b_val = net + 1;
    let b = format!(
        "{}.{}.{}.{}",
        (b_val >> 24) & 0xff,
        (b_val >> 16) & 0xff,
        (b_val >> 8) & 0xff,
        b_val & 0xff
    );
    let subnet = format!("{}/31", a);
    (a, b, subnet)
}

/// Compute a read-only preview of what a hierarchical (3-tier) topology build would produce.
/// No database writes and no Docker calls — only reads settings and device models.
pub(super) async fn compute_three_tier_preview(
    state: &Arc<AppState>,
    req: &UnifiedTopologyRequest,
) -> Result<TopologyPreviewResponse, ApiError> {
    // ── 1. Read hostname pattern from settings (read-only) ──────────────
    let settings = state.store.get_settings().await.unwrap_or_default();
    let hostname_pattern = &settings.hostname_pattern;

    // ── 2. Load device models for port-name resolution (read-only) ──────
    let all_models = state
        .store
        .list_device_models()
        .await
        .map_err(|e| ApiError::internal(format!("Failed to load device models: {}", e)))?;
    let model_100g_ports: HashMap<String, Vec<String>> = all_models
        .iter()
        .map(|m| (m.model.clone(), get_ports_by_min_speed(&m.layout, 100_000)))
        .collect();

    // ── 3. Map request fields to hierarchical names ─────────────────────
    let core_count = req.tier1_count;
    let dist_count = req.tier2_count;
    let access_count = req.tier3_count;
    let hall_count = req.halls;
    let rows_per_hall = req.rows_per_hall;
    let racks_per_row = req.racks_per_row;
    let devices_per_rack = req.devices_per_rack;
    let uplinks_per_dist = req.tier1_to_tier2_ratio;
    let links_per_access = req.tier2_to_tier3_ratio;
    let core_model = if req.tier1_model.is_empty() {
        "7280R3".to_string()
    } else {
        req.tier1_model.clone()
    };
    let dist_model = if req.tier2_model.is_empty() {
        "7050CX3-32S".to_string()
    } else {
        req.tier2_model.clone()
    };
    let access_model = if req.tier3_model.is_empty() {
        "7050SX3-48YC8".to_string()
    } else {
        req.tier3_model.clone()
    };
    let dc = match req.datacenter_id {
        Some(id) => state.store.get_ipam_datacenter(id).await
            .ok().flatten().map(|d| d.name).unwrap_or_default(),
        None => String::new(),
    };
    let dc = dc.as_str();
    let region = match req.region_id {
        Some(id) => state.store.get_ipam_region(id).await
            .ok().flatten().map(|r| r.name).unwrap_or_default(),
        None => String::new(),
    };
    let region = region.as_str();

    // ── 4. Compute rack layout as named racks ───────────────────────────
    let mut racks: Vec<TopologyPreviewRack> = Vec::new();
    let mut spine_rack_names: Vec<String> = Vec::new();
    let mut leaf_rack_names: Vec<String> = Vec::new();
    let mut rack_index: usize = 0;

    for h in 1..=hall_count {
        let hall_name = format!("Hall {}", h);
        for r in 1..=rows_per_hall {
            let row_name = format!("Hall {} Row {}", h, r);
            let mid = racks_per_row / 2;
            for k in 1..=racks_per_row {
                // Insert spine rack at the midpoint
                if k == mid + 1 {
                    let spine_name = format!("Hall {} Row {} Spine Rack", h, r);
                    racks.push(TopologyPreviewRack {
                        index: rack_index,
                        name: spine_name.clone(),
                        hall_name: hall_name.clone(),
                        row_name: row_name.clone(),
                        rack_type: "spine".to_string(),
                    });
                    spine_rack_names.push(spine_name);
                    rack_index += 1;
                }

                let leaf_name = format!("Hall {} Row {} Rack {}", h, r, k);
                racks.push(TopologyPreviewRack {
                    index: rack_index,
                    name: leaf_name.clone(),
                    hall_name: hall_name.clone(),
                    row_name: row_name.clone(),
                    rack_type: "leaf".to_string(),
                });
                leaf_rack_names.push(leaf_name);
                rack_index += 1;
            }
        }
    }

    // ── 5. Compute all devices ──────────────────────────────────────────
    let mut devices: Vec<TopologyPreviewDevice> = Vec::new();

    // 5a. Core devices — no rack assignment, external-like (no loopback/mgmt in build)
    for i in 1..=core_count {
        devices.push(TopologyPreviewDevice {
            index: i,
            hostname: resolve_hostname(hostname_pattern, dc, region, "", "core", i),
            role: "core".to_string(),
            loopback: format!("10.254.0.{}", i),
            asn: 64999_u32.saturating_sub(i as u32 - 1),
            model: core_model.clone(),
            mgmt_ip: format!("172.20.3.{}", 10 + i),
            rack_name: None,
            rack_index: None,
            rack_position: None,
            device_type: None,
        });
    }

    // 5b. Distribution devices — round-robin across spine racks
    for i in 1..=dist_count {
        let (rack_name, r_idx, pos) = if !spine_rack_names.is_empty() {
            let idx = (i - 1) % spine_rack_names.len();
            let pos_in_rack = ((i - 1) / spine_rack_names.len()) as i32 + 1;
            (
                Some(spine_rack_names[idx].clone()),
                Some(idx),
                Some(pos_in_rack),
            )
        } else {
            (None, None, None)
        };
        let hall_name = if !spine_rack_names.is_empty() {
            // Derive hall from the spine rack index
            let idx = (i - 1) % spine_rack_names.len();
            // Each hall has rows_per_hall spine racks
            let hall_idx = idx / rows_per_hall;
            (hall_idx + 1).to_string()
        } else {
            String::new()
        };
        devices.push(TopologyPreviewDevice {
            index: i,
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "distribution", i),
            role: "distribution".to_string(),
            loopback: format!("10.254.1.{}", i),
            asn: 65100,
            model: dist_model.clone(),
            mgmt_ip: format!("172.20.4.{}", 10 + i),
            rack_name,
            rack_index: r_idx,
            rack_position: pos,
            device_type: None,
        });
    }

    // 5c. Access devices — distributed by devices_per_rack
    for i in 1..=access_count {
        let (rack_name, r_idx, pos) = if !leaf_rack_names.is_empty() {
            let idx = (i - 1) / devices_per_rack;
            let pos_in_rack = (i - 1) % devices_per_rack;
            if idx < leaf_rack_names.len() {
                (
                    Some(leaf_rack_names[idx].clone()),
                    Some(idx),
                    Some(compute_rack_position(pos_in_rack, &req.tier3_placement, 42)),
                )
            } else {
                (None, None, None)
            }
        } else {
            (None, None, None)
        };
        let hall_name = if !leaf_rack_names.is_empty() {
            let idx = (i - 1) / devices_per_rack;
            // Each hall has rows_per_hall * racks_per_row leaf racks
            let racks_per_hall = rows_per_hall * racks_per_row;
            let hall_idx = if racks_per_hall > 0 { idx / racks_per_hall } else { 0 };
            (hall_idx + 1).to_string()
        } else {
            String::new()
        };
        devices.push(TopologyPreviewDevice {
            index: i,
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "access", i),
            role: "access".to_string(),
            loopback: format!("10.254.2.{}", i),
            asn: 65201_u32 + (i as u32 - 1),
            model: access_model.clone(),
            mgmt_ip: format!("172.20.5.{}", 10 + i),
            rack_name,
            rack_index: r_idx,
            rack_position: pos,
            device_type: None,
        });
    }

    // ── 6 & 7. Simulate P2P /31 links and compute fabric links ─────────
    // P2P base for hierarchical: 10.2.0.0 = 0x0A020000
    const P2P_BASE: u32 = 0x0A02_0000;
    let mut link_index: usize = 0;
    let mut fabric_links: Vec<TopologyPreviewLink> = Vec::new();

    // Collect device references by role for link computation
    let cores: Vec<&TopologyPreviewDevice> = devices.iter().filter(|d| d.role == "core").collect();
    let dists: Vec<&TopologyPreviewDevice> = devices.iter().filter(|d| d.role == "distribution").collect();
    let accesses: Vec<&TopologyPreviewDevice> = devices.iter().filter(|d| d.role == "access").collect();

    // Split distribution 100G ports: first 2/3 for access-facing, last 1/3 for core-facing uplinks
    let dist_all_ports = model_100g_ports.get(&dist_model).cloned().unwrap_or_default();
    let dist_access_port_count = (dist_all_ports.len() * 2 + 2) / 3; // ceil(2/3)
    let dist_access_ports: Vec<String> = dist_all_ports.iter().take(dist_access_port_count).cloned().collect();
    let dist_uplink_ports: Vec<String> = dist_all_ports.iter().skip(dist_access_port_count).cloned().collect();

    // 7a. Distribution <-> Access links (allocated first, same order as build_three_tier)
    for (di, dist) in dists.iter().enumerate() {
        for (ai, access) in accesses.iter().enumerate() {
            for link in 0..links_per_access {
                let (dist_ip, access_ip, subnet) = sim_ip(P2P_BASE, link_index);
                link_index += 1;

                // Distribution port: first 2/3 of 100G ports
                let dist_port_idx = ai * links_per_access + link;
                let dist_if_name = dist_access_ports
                    .get(dist_port_idx)
                    .cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", dist_port_idx + 1));

                // Access port: all 100G ports
                let access_port_idx = di * links_per_access + link;
                let access_100g = model_100g_ports
                    .get(&access.model)
                    .map(|p| p.as_slice())
                    .unwrap_or(&[]);
                let access_if_name = access_100g
                    .get(access_port_idx)
                    .cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", access_port_idx + 1));

                let cable_length_meters = estimate_cable_length(
                    dist.rack_index, dist.rack_position,
                    access.rack_index, access.rack_position,
                    racks_per_row, req.row_spacing_cm, settings.cable_slack_percent,
                );

                fabric_links.push(TopologyPreviewLink {
                    side_a_hostname: dist.hostname.clone(),
                    side_a_interface: dist_if_name,
                    side_a_ip: dist_ip,
                    side_b_hostname: access.hostname.clone(),
                    side_b_interface: access_if_name,
                    side_b_ip: access_ip,
                    subnet,
                    cable_length_meters,
                });
            }
        }
    }

    // 7b. Core <-> Distribution links
    for (ci, core) in cores.iter().enumerate() {
        for (di, dist) in dists.iter().enumerate() {
            for link in 0..uplinks_per_dist {
                let (core_ip, dist_ip, subnet) = sim_ip(P2P_BASE, link_index);
                link_index += 1;

                // Core port: all 100G ports, sequential
                let core_port_idx = di * uplinks_per_dist + link;
                let core_100g = model_100g_ports
                    .get(&core.model)
                    .map(|p| p.as_slice())
                    .unwrap_or(&[]);
                let core_if_name = core_100g
                    .get(core_port_idx)
                    .cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", core_port_idx + 1));

                // Distribution uplink port: last 1/3 of 100G ports
                let dist_uplink_idx = ci * uplinks_per_dist + link;
                let dist_if_name = dist_uplink_ports
                    .get(dist_uplink_idx)
                    .cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", dist_access_port_count + dist_uplink_idx + 1));

                let cable_length_meters = estimate_cable_length(
                    core.rack_index, core.rack_position,
                    dist.rack_index, dist.rack_position,
                    racks_per_row, req.row_spacing_cm, settings.cable_slack_percent,
                );

                fabric_links.push(TopologyPreviewLink {
                    side_a_hostname: core.hostname.clone(),
                    side_a_interface: core_if_name,
                    side_a_ip: core_ip,
                    side_b_hostname: dist.hostname.clone(),
                    side_b_interface: dist_if_name,
                    side_b_ip: dist_ip,
                    subnet,
                    cable_length_meters,
                });
            }
        }
    }

    // ── 8. Compute GPU cluster assignments + GPU node devices ──────────
    let gpu_clusters = if req.gpu_cluster_count > 0 {
        let access_devs: Vec<(usize, String, Option<usize>, Option<i32>)> = devices.iter()
            .filter(|d| d.role == "access")
            .map(|d| (d.index, d.hostname.clone(), d.rack_index, d.rack_position))
            .collect();
        let total_access = access_devs.len();
        let gpu_model_name = format!("{} 8-GPU Node", req.gpu_model);

        let mut dev_index = devices.len();
        let mut clusters: Vec<TopologyPreviewGpuCluster> = Vec::new();
        let mut gpu_counter: usize = 0;

        for ci in 0..req.gpu_cluster_count {
            let mut device_indices: Vec<usize> = Vec::new();
            let mut leaf_uplink_links: Vec<TopologyPreviewLink> = Vec::new();
            let mut cluster_fabric_links: Vec<TopologyPreviewLink> = Vec::new();
            let mut leaf_assignments: Vec<String> = Vec::new();

            for ni in 0..req.gpu_nodes_per_cluster {
                let access_idx = (ci * req.gpu_nodes_per_cluster + ni) % total_access.max(1);
                let (_, access_hostname, access_rack_idx, access_rack_pos) = access_devs.get(access_idx)
                    .cloned()
                    .unwrap_or((0, String::new(), None, None));
                leaf_assignments.push(access_hostname.clone());

                gpu_counter += 1;
                let gpu_hostname = resolve_hostname(hostname_pattern, dc, region, "", "gpu-node", gpu_counter);
                let gpu_rack_name = access_rack_idx.and_then(|ri| leaf_rack_names.get(ri).cloned());
                let gpu_rack_pos = access_rack_pos.map(|p| p + 4 + (ni as i32 * 4));

                devices.push(TopologyPreviewDevice {
                    index: dev_index,
                    hostname: gpu_hostname.clone(),
                    role: "gpu-node".to_string(),
                    loopback: String::new(),
                    asn: 0,
                    model: gpu_model_name.clone(),
                    mgmt_ip: format!("172.20.6.{}", 10 + ci * req.gpu_nodes_per_cluster + ni + 1),
                    rack_name: gpu_rack_name,
                    rack_index: access_rack_idx,
                    rack_position: gpu_rack_pos,
                    device_type: Some("internal".to_string()),
                });
                device_indices.push(dev_index);
                dev_index += 1;

                // Leaf uplink links (2 per GPU node)
                if req.gpu_include_leaf_uplinks && !access_hostname.is_empty() {
                    let access_dev = access_devs.get(access_idx);
                    for ul in 0..2u32 {
                        let (gpu_ip, access_ip, subnet) = sim_ip(P2P_BASE, link_index);
                        let cable_length_meters = access_dev.map(|(_, _, ari, arp)| {
                            estimate_cable_length(
                                access_rack_idx, gpu_rack_pos,
                                *ari, *arp,
                                racks_per_row, req.row_spacing_cm, settings.cable_slack_percent,
                            )
                        }).flatten();

                        leaf_uplink_links.push(TopologyPreviewLink {
                            side_a_hostname: gpu_hostname.clone(),
                            side_a_interface: format!("Ethernet{}", ul + 1),
                            side_a_ip: gpu_ip,
                            side_b_hostname: access_hostname.clone(),
                            side_b_interface: format!("Ethernet{}", 33 + ci * req.gpu_nodes_per_cluster * 2 + ni * 2 + ul as usize),
                            side_b_ip: access_ip,
                            subnet,
                            cable_length_meters,
                        });
                        link_index += 1;
                    }
                }
            }

            // GPU fabric links — full mesh within cluster
            if req.gpu_include_fabric_cabling && req.gpu_nodes_per_cluster > 1 {
                let is_ib = req.gpu_interconnect == "InfiniBand" || req.gpu_interconnect == "InfinityFabric";
                let mut port_counters: Vec<usize> = vec![0; req.gpu_nodes_per_cluster];

                for a in 0..req.gpu_nodes_per_cluster {
                    for b in (a + 1)..req.gpu_nodes_per_cluster {
                        let a_port = port_counters[a];
                        let b_port = port_counters[b];
                        port_counters[a] += 1;
                        port_counters[b] += 1;

                        let a_if = if is_ib { format!("IB{}", a_port + 1) } else { format!("Ethernet{}", a_port + 3) };
                        let b_if = if is_ib { format!("IB{}", b_port + 1) } else { format!("Ethernet{}", b_port + 3) };

                        let a_dev = &devices[device_indices[a]];
                        let b_dev = &devices[device_indices[b]];

                        let cable_length_meters = estimate_cable_length(
                            a_dev.rack_index, a_dev.rack_position,
                            b_dev.rack_index, b_dev.rack_position,
                            racks_per_row, req.row_spacing_cm, settings.cable_slack_percent,
                        );

                        cluster_fabric_links.push(TopologyPreviewLink {
                            side_a_hostname: a_dev.hostname.clone(),
                            side_a_interface: a_if,
                            side_a_ip: String::new(),
                            side_b_hostname: b_dev.hostname.clone(),
                            side_b_interface: b_if,
                            side_b_ip: String::new(),
                            subnet: String::new(),
                            cable_length_meters,
                        });
                    }
                }
            }

            clusters.push(TopologyPreviewGpuCluster {
                name: format!("gpu-cluster-{}", ci + 1),
                gpu_model: req.gpu_model.clone(),
                node_count: req.gpu_nodes_per_cluster,
                gpus_per_node: req.gpus_per_node,
                interconnect: req.gpu_interconnect.clone(),
                leaf_assignments,
                device_indices,
                leaf_uplink_links,
                fabric_links: cluster_fabric_links,
            });
        }
        clusters
    } else {
        Vec::new()
    };

    // ── 9. Add management switches based on distribution setting ────────
    let mut dev_index = devices.len();
    let mgmt_model = if req.mgmt_switch_model.is_empty() { "CCS-720XP-48ZC2".to_string() } else { req.mgmt_switch_model.clone() };
    let mgmt_dist = if req.mgmt_switch_distribution.is_empty() { "per-row" } else { &req.mgmt_switch_distribution };
    let mgmt_count_per_row = req.mgmt_switches_per_row.max(1);
    let mut mgmt_counter: usize = 0;
    for h in 1..=hall_count {
        let hall_str = h.to_string();
        if mgmt_dist == "per-hall" {
            let row_name = format!("Hall {} Row 1", h);
            let first_rack = racks.iter().find(|rk| rk.row_name == row_name);
            let (rack_name, rack_idx) = match first_rack {
                Some(rk) => (Some(rk.name.clone()), Some(rk.index)),
                None => (None, None),
            };
            mgmt_counter += 1;
            devices.push(TopologyPreviewDevice {
                index: dev_index,
                hostname: resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter),
                role: "mgmt-switch".to_string(),
                loopback: String::new(),
                asn: 0,
                model: mgmt_model.clone(),
                mgmt_ip: format!("172.20.7.{}", 10 + mgmt_counter),
                rack_name,
                rack_index: rack_idx,
                rack_position: Some(41),
                device_type: Some("internal".to_string()),
            });
            dev_index += 1;
            continue;
        }
        for r in 1..=rows_per_hall {
            let row_name = format!("Hall {} Row {}", h, r);
            if mgmt_dist == "per-rack" {
                let row_racks: Vec<_> = racks.iter().filter(|rk| rk.row_name == row_name).collect();
                for (_ri, rack) in row_racks.iter().enumerate() {
                    mgmt_counter += 1;
                    devices.push(TopologyPreviewDevice {
                        index: dev_index,
                        hostname: resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter),
                        role: "mgmt-switch".to_string(),
                        loopback: String::new(),
                        asn: 0,
                        model: mgmt_model.clone(),
                        mgmt_ip: format!("172.20.7.{}", 10 + mgmt_counter),
                        rack_name: Some(rack.name.clone()),
                        rack_index: Some(rack.index),
                        rack_position: Some(41),
                        device_type: Some("internal".to_string()),
                    });
                    dev_index += 1;
                }
            } else {
                let count = if mgmt_dist == "count-per-row" { mgmt_count_per_row } else { 1 };
                let first_rack = racks.iter().find(|rk| rk.row_name == row_name);
                let (rack_name, rack_idx) = match first_rack {
                    Some(rk) => (Some(rk.name.clone()), Some(rk.index)),
                    None => (None, None),
                };
                for m in 1..=count {
                    mgmt_counter += 1;
                    devices.push(TopologyPreviewDevice {
                        index: dev_index,
                        hostname: resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter),
                        role: "mgmt-switch".to_string(),
                        loopback: String::new(),
                        asn: 0,
                        model: mgmt_model.clone(),
                        mgmt_ip: format!("172.20.7.{}", 10 + mgmt_counter),
                        rack_name: rack_name.clone(),
                        rack_index: rack_idx,
                        rack_position: Some(41 - m as i32 + 1),
                        device_type: Some("internal".to_string()),
                    });
                    dev_index += 1;
                }
            }
        }
    }

    // ── 10. Return preview response ──────────────────────────────────────
    Ok(TopologyPreviewResponse {
        architecture: "hierarchical".to_string(),
        topology_name: if req.topology_name.is_empty() { THREE_TIER_TOPOLOGY_NAME.to_string() } else { req.topology_name.clone() },
        devices,
        fabric_links,
        racks,
        tier3_placement: if req.tier3_placement.is_empty() {
            "bottom".to_string()
        } else {
            req.tier3_placement.clone()
        },
        gpu_clusters,
    })
}

/// Build a hierarchical (3-tier) topology from a UnifiedTopologyRequest
pub async fn build_three_tier(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    req: UnifiedTopologyRequest,
    overrides: Option<TopologyOverrides>,
) -> Result<Json<TopologyBuildResponse>, ApiError> {
    // Teardown any existing hierarchical topology first
    teardown_three_tier_inner(&state).await;

    // Map unified tier fields to hierarchical-specific names
    let core_count = req.tier1_count;
    let dist_count = req.tier2_count;
    let access_count = req.tier3_count;
    let hall_count = req.halls;
    let rows_per_hall = req.rows_per_hall;
    let racks_per_row = req.racks_per_row;
    let row_spacing_cm = req.row_spacing_cm;
    let devices_per_rack = req.devices_per_rack;
    let uplinks_per_dist = req.tier1_to_tier2_ratio;
    let links_per_access = req.tier2_to_tier3_ratio;
    let core_model = if req.tier1_model.is_empty() { "7280R3".to_string() } else { req.tier1_model.clone() };
    let dist_model = if req.tier2_model.is_empty() { "7050CX3-32S".to_string() } else { req.tier2_model.clone() };
    let access_model = if req.tier3_model.is_empty() { "7050SX3-48YC8".to_string() } else { req.tier3_model.clone() };
    let datacenter_id = req.datacenter_id;
    let dc = match datacenter_id {
        Some(id) => state.store.get_ipam_datacenter(id).await
            .ok().flatten().map(|d| d.name).unwrap_or_default(),
        None => String::new(),
    };
    let dc = dc.as_str();
    let region = match req.region_id {
        Some(id) => state.store.get_ipam_region(id).await
            .ok().flatten().map(|r| r.name).unwrap_or_default(),
        None => String::new(),
    };
    let region = region.as_str();
    let topo_name = if req.topology_name.is_empty() { THREE_TIER_TOPOLOGY_NAME.to_string() } else { req.topology_name.clone() };

    // Load hostname pattern + cable slack from settings
    let settings = state.store.get_settings().await.unwrap_or_default();
    let hostname_pattern = &settings.hostname_pattern;
    let cable_slack_percent = settings.cable_slack_percent;

    let spawn_containers = req.spawn_containers;
    let ceos_image = if req.ceos_image.is_empty() {
        std::env::var("CEOS_IMAGE").unwrap_or_else(|_| "ceosimage:latest".to_string())
    } else {
        req.ceos_image.clone()
    };

    // Detect vendor from image (FRR vs Arista)
    let use_frr = spawn_containers && is_frr_image(&ceos_image);
    let vendor_name = if use_frr { "frr" } else { "arista" };
    let vendor_id = match state.store.get_vendor_by_name(vendor_name).await? {
        Some(v) => v.id.to_string(),
        None => vendor_name.to_string(),
    };

    // Resolve the vendor's base template ID for config_template on devices
    let vendor_base_template_id: String = match state.store.get_vendor_by_name(vendor_name).await? {
        Some(v) if !v.default_template.is_empty() => v.default_template,
        _ => String::new(),
    };

    // Look up device roles to resolve group_names per topology role
    let mut role_group_names: HashMap<String, Vec<String>> = HashMap::new();
    for role_name in ["core", "distribution", "access"] {
        // Try vendor-prefixed name first (e.g. "arista-core"), then plain role name
        let device_role_name = format!("{}-{}", vendor_name, role_name);
        let found_role = match state.store.find_device_role_by_name(&device_role_name).await {
            Ok(Some(r)) => Some(r),
            _ => state.store.find_device_role_by_name(role_name).await.ok().flatten(),
        };
        if let Some(role) = found_role {
            if !role.group_names.is_empty() {
                role_group_names.insert(role_name.to_string(), role.group_names.clone());
            }
        }
    }

    // Create topology
    let topo_req = crate::models::CreateTopologyRequest {
        name: topo_name.clone(),
        description: Some(format!(
            "{}-core / {}-distribution / {}-access hierarchical fabric",
            core_count, dist_count, access_count
        )),
        region_id: req.region_id,
        campus_id: req.campus_id,
        datacenter_id: req.datacenter_id,
    };
    let topo_id = match state.store.create_topology(&topo_req).await {
        Ok(t) => t.id,
        Err(e) => {
            tracing::warn!("Failed to create hierarchical topology: {}", e);
            0
        }
    };

    // Auto-create org hierarchy (halls/rows/racks) when datacenter is provided
    // Each rack entry: (hall_id, row_id, rack_id)
    let mut rack_placements: Vec<(i64, i64, i64)> = Vec::new();
    // Spine racks (distribution switches placed here): one per row
    let mut spine_racks: Vec<(i64, i64, i64)> = Vec::new();
    // All racks in preview-order (spine at midpoint interspersed with leaf racks)
    // Used to resolve preview rack_index -> DB rack IDs for overrides
    let mut all_racks: Vec<(i64, i64, i64)> = Vec::new();
    // Map row_id -> patch panel device ID for port assignment wiring
    let mut patch_panels: HashMap<i64, i64> = HashMap::new();
    // Management switch entries: (hall_id, row_id, rack_id or None, device_id)
    let mut mgmt_switches: Vec<(i64, i64, Option<i64>, i64)> = Vec::new();
    // Map row_id -> first rack ID (for patch panel placement)
    let mut row_first_rack: HashMap<i64, i64> = HashMap::new();

    if let Some(dc_id) = datacenter_id {
        for h in 1..=hall_count {
            let hall_req = crate::models::CreateIpamHallRequest {
                name: format!("Hall {}", h),
                description: Some("Auto-created by Hierarchical Build".to_string()),
                datacenter_id: dc_id,
            };
            let hall_id = match state.store.create_ipam_hall(&hall_req).await {
                Ok(hall) => hall.id,
                Err(e) => {
                    tracing::warn!("Failed to create hall {}: {}", h, e);
                    continue;
                }
            };

            for r in 1..=rows_per_hall {
                let row_req = crate::models::CreateIpamRowRequest {
                    name: format!("Hall {} Row {}", h, r),
                    description: Some("Auto-created by Hierarchical Build".to_string()),
                    hall_id,
                };
                let row_id = match state.store.create_ipam_row(&row_req).await {
                    Ok(row) => row.id,
                    Err(e) => {
                        tracing::warn!("Failed to create row hall-{}-row-{}: {}", h, r, e);
                        continue;
                    }
                };

                // Create access racks with distribution rack in the middle of the row
                let mid = racks_per_row / 2;
                for k in 1..=racks_per_row {
                    if k == mid + 1 {
                        let spine_rack_req = crate::models::CreateIpamRackRequest {
                            name: format!("Hall {} Row {} Spine Rack", h, r),
                            description: Some("Auto-created by Hierarchical Build — distribution switches".to_string()),
                            row_id,
                        };
                        match state.store.create_ipam_rack(&spine_rack_req).await {
                            Ok(rack) => {
                                spine_racks.push((hall_id, row_id, rack.id));
                                all_racks.push((hall_id, row_id, rack.id));
                                row_first_rack.entry(row_id).or_insert(rack.id);
                            }
                            Err(e) => {
                                tracing::warn!("Failed to create distribution rack: {}", e);
                            }
                        }
                    }

                    let rack_req = crate::models::CreateIpamRackRequest {
                        name: format!("Hall {} Row {} Rack {}", h, r, k),
                        description: Some("Auto-created by Hierarchical Build".to_string()),
                        row_id,
                    };
                    match state.store.create_ipam_rack(&rack_req).await {
                        Ok(rack) => {
                            rack_placements.push((hall_id, row_id, rack.id));
                            all_racks.push((hall_id, row_id, rack.id));
                            row_first_rack.entry(row_id).or_insert(rack.id);
                        }
                        Err(e) => {
                            tracing::warn!("Failed to create rack hall-{}-row-{}-rack-{}: {}", h, r, k, e);
                        }
                    }
                }

                // Create a patch panel device for this row, placed in rack 1
                let pp_rack_id = row_first_rack.get(&row_id).copied();
                let pp_hostname = format!("hier-hall-{}-row-{}-pp", h, r);
                let pp_req = crate::models::CreateDeviceRequest {
                    mac: String::new(),
                    ip: String::new(),
                    hostname: pp_hostname.clone(),
                    vendor: Some("patch-panel".to_string()),
                    model: Some("PP-192-RJ45".to_string()),
                    serial_number: Some(format!("SN-HIER-{}", pp_hostname)),
                    config_template: String::new(),
                    ssh_user: None,
                    ssh_pass: None,
                    topology_id: Some(topo_id),
                    topology_role: Some("patch-panel".to_string()),
                    device_type: Some("external".to_string()),
                    hall_id: Some(hall_id),
                    row_id: Some(row_id),
                    rack_id: pp_rack_id,
                    rack_position: Some(42),
                };
                match state.store.create_device(&pp_req).await {
                    Ok(pp_dev) => {
                        patch_panels.insert(row_id, pp_dev.id);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to create patch panel {}: {}", pp_hostname, e);
                    }
                }
            }
        }
    }

    // Create management switches based on distribution setting
    {
        let mgmt_model = if req.mgmt_switch_model.is_empty() { "CCS-720XP-48ZC2".to_string() } else { req.mgmt_switch_model.clone() };
        let mgmt_dist = if req.mgmt_switch_distribution.is_empty() { "per-row" } else { req.mgmt_switch_distribution.as_str() };
        let mgmt_count_per_row = req.mgmt_switches_per_row.max(1);
        let mut mgmt_counter: usize = 0;

        let create_mgmt = |counter: usize, hostname: &str, hall_id: i64, row_id: i64, rack_id: Option<i64>, rack_pos: i32| {
            crate::models::CreateDeviceRequest {
                mac: generate_arista_mac(),
                ip: format!("172.20.7.{}", 10 + counter),
                hostname: hostname.to_string(),
                vendor: Some(vendor_id.to_string()),
                model: Some(mgmt_model.clone()),
                serial_number: Some(format!("SN-HIER-{}", hostname)),
                config_template: String::new(),
                ssh_user: Some("admin".to_string()),
                ssh_pass: Some("admin".to_string()),
                topology_id: Some(topo_id),
                topology_role: Some("mgmt-switch".to_string()),
                device_type: Some("internal".to_string()),
                hall_id: Some(hall_id),
                row_id: Some(row_id),
                rack_id,
                rack_position: Some(rack_pos),
            }
        };

        if mgmt_dist == "per-hall" {
            for &(hall_id, row_id, _) in rack_placements.iter() {
                let first_row = rack_placements.iter().filter(|(h, _, _)| *h == hall_id).map(|(_, r, _)| *r).min();
                if first_row != Some(row_id) { continue; }
                if mgmt_switches.iter().any(|(h, _, _, _)| *h == hall_id) { continue; }
                mgmt_counter += 1;
                let rack_id = row_first_rack.get(&row_id).copied();
                let hall_str = hall_id.to_string();
                let hostname = resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter);
                let req = create_mgmt(mgmt_counter, &hostname, hall_id, row_id, rack_id, 41);
                match state.store.create_device(&req).await {
                    Ok(dev) => { mgmt_switches.push((hall_id, row_id, None, dev.id)); }
                    Err(e) => { tracing::warn!("Failed to create mgmt switch {}: {}", hostname, e); }
                }
            }
        } else if mgmt_dist == "per-rack" {
            for &(hall_id, row_id, rack_id) in &all_racks {
                mgmt_counter += 1;
                let hall_str = hall_id.to_string();
                let hostname = resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter);
                let req = create_mgmt(mgmt_counter, &hostname, hall_id, row_id, Some(rack_id), 41);
                match state.store.create_device(&req).await {
                    Ok(dev) => { mgmt_switches.push((hall_id, row_id, Some(rack_id), dev.id)); }
                    Err(e) => { tracing::warn!("Failed to create mgmt switch {}: {}", hostname, e); }
                }
            }
        } else {
            let count = if mgmt_dist == "count-per-row" { mgmt_count_per_row } else { 1 };
            let mut seen_rows: Vec<(i64, i64)> = Vec::new();
            for &(hall_id, row_id, _) in &all_racks {
                if seen_rows.contains(&(hall_id, row_id)) { continue; }
                seen_rows.push((hall_id, row_id));
                let rack_id = row_first_rack.get(&row_id).copied();
                for m in 1..=count {
                    mgmt_counter += 1;
                    let hall_str = hall_id.to_string();
                    let hostname = resolve_hostname(hostname_pattern, dc, region, &hall_str, "mgmt-switch", mgmt_counter);
                    let req = create_mgmt(mgmt_counter, &hostname, hall_id, row_id, rack_id, 41 - m as i32 + 1);
                    match state.store.create_device(&req).await {
                        Ok(dev) => { mgmt_switches.push((hall_id, row_id, None, dev.id)); }
                        Err(e) => { tracing::warn!("Failed to create mgmt switch {}: {}", hostname, e); }
                    }
                }
            }
        }
    }

    // Build node list: core + distribution + access

    let mut nodes: Vec<VNode> = Vec::new();

    // Core nodes: not assigned to any rack (like externals in CLOS)
    for i in 1..=core_count {
        nodes.push(VNode {
            hostname: resolve_hostname(hostname_pattern, dc, region, "", "core", i),
            role: "core".to_string(),
            loopback: format!("10.254.0.{}", i),
            asn: 64999_u32.saturating_sub(i as u32 - 1),
            model: core_model.clone(),
            mgmt_ip: format!("172.20.3.{}", 10 + i),
            hall_id: None,
            row_id: None,
            rack_id: None,
            rack_position: None,
            device_type: Some("external".to_string()),
        });
    }

    // Distribution nodes: placed in "spine racks" (like spines in CLOS)
    // Distribute round-robin across rows (one spine rack per row)
    for i in 1..=dist_count {
        let (h, r, rk, pos) = if !spine_racks.is_empty() {
            let rack_idx = (i - 1) % spine_racks.len();
            let pos_in_rack = ((i - 1) / spine_racks.len()) as i32 + 1;
            let p = &spine_racks[rack_idx];
            (Some(p.0), Some(p.1), Some(p.2), Some(pos_in_rack))
        } else {
            (None, None, None, None)
        };
        let hall_name = h.map(|id| id.to_string()).unwrap_or_default();
        nodes.push(VNode {
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "distribution", i),
            role: "distribution".to_string(),
            loopback: format!("10.254.1.{}", i),
            asn: 65100,
            model: dist_model.clone(),
            mgmt_ip: format!("172.20.4.{}", 10 + i),
            hall_id: h,
            row_id: r,
            rack_id: rk,
            rack_position: pos,
            device_type: None,
        });
    }

    // Access nodes: placed in leaf racks (like leaves in CLOS)
    // Distribute across racks: devices_per_rack per rack
    let placement = &req.tier3_placement;
    for i in 1..=access_count {
        let (h, r, rk, pos) = if !rack_placements.is_empty() {
            let rack_idx = (i - 1) / devices_per_rack;
            let device_in_rack = (i - 1) % devices_per_rack;
            let pos_in_rack = compute_rack_position(device_in_rack, placement, 42);
            if rack_idx < rack_placements.len() {
                let p = &rack_placements[rack_idx];
                (Some(p.0), Some(p.1), Some(p.2), Some(pos_in_rack))
            } else {
                (None, None, None, None)
            }
        } else {
            (None, None, None, None)
        };
        let hall_name = h.map(|id| id.to_string()).unwrap_or_default();
        nodes.push(VNode {
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "access", i),
            role: "access".to_string(),
            loopback: format!("10.254.2.{}", i),
            asn: 65201_u32 + (i as u32 - 1),
            model: access_model.clone(),
            mgmt_ip: format!("172.20.5.{}", 10 + i),
            hall_id: h,
            row_id: r,
            rack_id: rk,
            rack_position: pos,
            device_type: None,
        });
    }

    // Apply overrides: if the user edited the preview, replace node fields
    if let Some(ref ov) = overrides {
        for (idx, node) in nodes.iter_mut().enumerate() {
            if let Some(ov_dev) = ov.devices.iter().find(|d| d.index == idx) {
                node.hostname = ov_dev.hostname.clone();
                node.loopback = ov_dev.loopback.clone();
                node.asn = ov_dev.asn;
                node.mgmt_ip = ov_dev.mgmt_ip.clone();
                if let Some(rp) = ov_dev.rack_position {
                    node.rack_position = Some(rp);
                }
                // Resolve rack reassignment: map preview rack_index to actual DB rack IDs
                if let Some(ri) = ov_dev.rack_index {
                    if let Some(&(h, r, rk)) = all_racks.get(ri) {
                        node.hall_id = Some(h);
                        node.row_id = Some(r);
                        node.rack_id = Some(rk);
                    }
                } else {
                    // User unassigned from rack
                    node.hall_id = None;
                    node.row_id = None;
                    node.rack_id = None;
                    node.rack_position = None;
                }
            }
        }
    }

    // Helper: map rack_id -> index in all_racks for cable length estimation
    let find_rack_index = |rack_id: Option<i64>| -> Option<usize> {
        rack_id.and_then(|rid| all_racks.iter().position(|&(_, _, rk)| rk == rid))
    };

    // Create device records + collect results
    let mut result_devices = Vec::new();
    let mut created_ids: Vec<(i64, VNode)> = Vec::new();

    for node in nodes {
        let mac = if use_frr { generate_mac() } else { generate_arista_mac() };
        let serial = format!("SN-HIER-{}", node.hostname);

        let dev_req = crate::models::CreateDeviceRequest {
            mac: mac.clone(),
            ip: node.mgmt_ip.clone(),
            hostname: node.hostname.clone(),
            vendor: Some(vendor_id.to_string()),
            model: Some(node.model.to_string()),
            serial_number: Some(serial),
            config_template: vendor_base_template_id.clone(),
            ssh_user: Some("admin".to_string()),
            ssh_pass: Some("admin".to_string()),
            topology_id: Some(topo_id),
            topology_role: Some(node.role.clone()),
            device_type: node.device_type.clone(),
            hall_id: node.hall_id.clone(),
            row_id: node.row_id.clone(),
            rack_id: node.rack_id.clone(),
            rack_position: node.rack_position,
        };

        match state.store.create_device(&dev_req).await {
            Ok(dev) => {
                // Auto-assign device to role-based groups
                if let Some(group_names) = role_group_names.get(&node.role) {
                    for group_name in group_names {
                        // Look up group by name, create if it doesn't exist
                        let group_id = match state.store.get_group_by_name(group_name).await {
                            Ok(Some(g)) => g.id,
                            _ => {
                                let group_req = crate::models::CreateGroupRequest {
                                    name: group_name.clone(),
                                    description: Some("Auto-created for device role".to_string()),
                                    parent_id: None,
                                    precedence: 100,
                                };
                                match state.store.create_group(&group_req).await {
                                    Ok(g) => g.id,
                                    Err(e) => {
                                        tracing::warn!("Failed to create group {}: {}", group_name, e);
                                        continue;
                                    }
                                }
                            }
                        };
                        if let Err(e) = state.store.add_device_to_group(dev.id, group_id).await {
                            tracing::warn!("Failed to add {} to group {}: {}", node.hostname, group_name, e);
                        }
                    }
                }
                result_devices.push(TopologyBuildDevice {
                    hostname: node.hostname.clone(),
                    role: node.role.to_string(),
                    mac: mac.clone(),
                    ip: node.mgmt_ip.clone(),
                    container_name: String::new(),
                });
                created_ids.push((dev.id, node));
            }
            Err(e) => {
                tracing::warn!("Failed to create hierarchical device {}: {}", node.hostname, e);
            }
        }
    }

    // Look up parent supernet by CIDR (needed for both pools)
    let parent = state.store.find_ipam_prefix_by_cidr(THREE_TIER_P2P_PARENT_CIDR, None).await
        .map_err(|e| ApiError::internal(format!("Failed to find parent supernet: {}", e)))?
        .ok_or_else(|| ApiError::bad_request(&format!(
            "Parent supernet {} must exist before building hierarchical fabric", THREE_TIER_P2P_PARENT_CIDR
        )))?;

    // Find or create the "pool" IPAM role
    let pool_role_id = match state.store.find_ipam_role_by_name("pool").await? {
        Some(r) => r.id,
        None => {
            let role_req = crate::models::CreateIpamRoleRequest {
                name: "pool".to_string(),
                description: Some("Address/prefix pool".to_string()),
            };
            state.store.create_ipam_role(&role_req).await
                .map_err(|e| ApiError::internal(format!("Failed to create pool role: {}", e)))?.id
        }
    };

    // Ensure P2P prefix pool exists in IPAM (10.2.0.0/16 under parent supernet)
    let p2p_pool = match state.store.find_ipam_prefix_by_cidr(THREE_TIER_P2P_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: THREE_TIER_P2P_CIDR.to_string(),
                description: Some("Hierarchical fabric P2P link pool".to_string()),
                status: "active".to_string(),
                is_supernet: false,
                role_ids: vec![pool_role_id],
                parent_id: Some(parent.id),
                datacenter_id: None,
                vlan_id: None,
                vrf_id: None,
            };
            state.store.create_ipam_prefix(&req).await
                .map_err(|e| ApiError::internal(format!("Failed to create P2P pool in IPAM: {}", e)))?
        }
    };

    // Ensure Loopback prefix pool exists in IPAM (10.254.0.0/16 under parent supernet)
    let loopback_pool = match state.store.find_ipam_prefix_by_cidr(THREE_TIER_LOOPBACK_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: THREE_TIER_LOOPBACK_CIDR.to_string(),
                description: Some("Hierarchical loopback address pool".to_string()),
                status: "active".to_string(),
                is_supernet: false,
                role_ids: vec![pool_role_id],
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
        let lo_req = crate::models::CreateIpamIpAddressRequest {
            address: node.loopback.clone(),
            prefix_id: loopback_pool.id,
            description: Some(format!("{} Loopback0", node.hostname)),
            status: "active".to_string(),
            role_ids: vec![],
            dns_name: Some(format!("{}.lo", node.hostname)),
            device_id: Some(*device_id),
            interface_name: Some("Loopback0".to_string()),
            vrf_id: None,
        };
        if let Err(e) = state.store.create_ipam_ip_address(&lo_req).await {
            tracing::warn!("Failed to reserve loopback {} for {}: {}", node.loopback, node.hostname, e);
        }
    }

    // Build fabric links using IPAM-allocated /31 subnets
    let cores: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "core").collect();
    let dists: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "distribution").collect();
    let accesses: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "access").collect();

    // Peer variables: core_vars[idx] = Vec of (peer_idx, peer_ip, peer_asn, peer_name, local_addr)
    let mut core_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); cores.len()];
    let mut dist_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); dists.len()];
    let mut access_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); accesses.len()];
    let mut fabric_links = Vec::new();

    // Load device models to dynamically resolve port names by speed.
    let all_models = state.store.list_device_models().await
        .map_err(|e| ApiError::internal(format!("Failed to load device models: {}", e)))?;
    let model_100g_ports: HashMap<String, Vec<String>> = all_models.iter()
        .map(|m| (m.model.clone(), get_ports_by_min_speed(&m.layout, 100_000)))
        .collect();

    // Split distribution 100G ports: first 2/3 for access-facing, last 1/3 for core-facing uplinks
    let dist_all_ports = model_100g_ports.get(&dist_model).cloned().unwrap_or_default();
    let dist_access_port_count = (dist_all_ports.len() * 2 + 2) / 3; // ceil(2/3)
    let dist_access_ports: Vec<String> = dist_all_ports.iter().take(dist_access_port_count).cloned().collect();
    let dist_uplink_ports: Vec<String> = dist_all_ports.iter().skip(dist_access_port_count).cloned().collect();

    // ─── Distribution <-> Access links ─────────────────────────────────────
    // Each distribution-access pair gets links_per_access /31 links
    for (di, (dist_device_id, dist)) in dists.iter().enumerate() {
        for (ai, (access_device_id, access)) in accesses.iter().enumerate() {
            for link in 0..links_per_access as u32 {
                // Allocate a /31 from IPAM
                let alloc_req = crate::models::NextAvailablePrefixRequest {
                    prefix_length: 31,
                    description: Some(format!("{} <-> {} link {}", dist.hostname, access.hostname, link + 1)),
                    status: "active".to_string(),
                    datacenter_id: None,
                };
                let subnet = state.store.next_available_ipam_prefix(p2p_pool.id, &alloc_req).await
                    .map_err(|e| ApiError::internal(format!("Failed to allocate /31: {}", e)))?;

                let net = subnet.network_int as u32;
                let dist_ip = crate::utils::u32_to_ipv4(net);       // even (network)
                let access_ip = crate::utils::u32_to_ipv4(net + 1); // odd (broadcast)

                // Distribution port: first 2/3 of 100G ports for access-facing
                let dist_port_idx = ai * links_per_access + link as usize;
                let dist_if_name = dist_access_ports.get(dist_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", dist_port_idx + 1));
                let dist_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: dist_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", dist.hostname, dist_if_name, access.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*dist_device_id),
                    interface_name: Some(dist_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&dist_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", dist_ip, dist.hostname, e);
                }

                // Access port: all 100G ports for distribution uplinks (like leaf->spine in CLOS)
                let access_port_idx = di * links_per_access + link as usize;
                let access_100g = model_100g_ports.get(&access.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let access_if_name = access_100g.get(access_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", access_port_idx + 1));
                // Extract port number from the resolved port name for peer variable keys
                let access_peer_idx: usize = access_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(access_port_idx + 1);
                let access_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: access_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", access.hostname, access_if_name, dist.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*access_device_id),
                    interface_name: Some(access_if_name),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&access_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", access_ip, access.hostname, e);
                }

                // Distribution peer index: extract port number from resolved port name
                let dist_peer_idx: usize = dist_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(dist_port_idx + 1);
                dist_vars[di].push((dist_peer_idx, access_ip.clone(), access.asn.to_string(), access.hostname.clone(), dist_ip.clone()));
                access_vars[ai].push((access_peer_idx, dist_ip.clone(), dist.asn.to_string(), dist.hostname.clone(), access_ip.clone()));

                fabric_links.push(format!(
                    "{} ({}) <-> {} ({}) [{}]",
                    dist.hostname, dist_ip, access.hostname, access_ip, subnet.prefix
                ));
            }
        }
    }

    // ─── Core <-> Distribution uplinks ─────────────────────────────────────
    // Each core-distribution pair gets uplinks_per_dist /31 links
    for (ci, (core_device_id, core)) in cores.iter().enumerate() {
        for (di, (dist_device_id, dist)) in dists.iter().enumerate() {
            for link in 0..uplinks_per_dist {
                let alloc_req = crate::models::NextAvailablePrefixRequest {
                    prefix_length: 31,
                    description: Some(format!("{} <-> {} uplink {}", core.hostname, dist.hostname, link + 1)),
                    status: "active".to_string(),
                    datacenter_id: None,
                };
                let subnet = state.store.next_available_ipam_prefix(p2p_pool.id, &alloc_req).await
                    .map_err(|e| ApiError::internal(format!("Failed to allocate uplink /31: {}", e)))?;

                let net = subnet.network_int as u32;
                let core_ip = crate::utils::u32_to_ipv4(net);
                let dist_ip = crate::utils::u32_to_ipv4(net + 1);

                // Core device interface (100G ports, sequential)
                let core_port_idx = di * uplinks_per_dist + link;
                let core_100g = model_100g_ports.get(&core.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let core_if_name = core_100g.get(core_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", core_port_idx + 1));
                let core_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: core_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", core.hostname, core_if_name, dist.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*core_device_id),
                    interface_name: Some(core_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&core_ip_req).await {
                    tracing::warn!("Failed to reserve uplink IP {} for {}: {}", core_ip, core.hostname, e);
                }

                // Distribution uplink interface (last 1/3 of 100G ports, like spine uplinks in CLOS)
                let dist_uplink_idx = ci * uplinks_per_dist + link;
                let dist_if_name = dist_uplink_ports.get(dist_uplink_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", dist_access_port_count + dist_uplink_idx + 1));
                let dist_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: dist_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", dist.hostname, dist_if_name, core.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*dist_device_id),
                    interface_name: Some(dist_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&dist_ip_req).await {
                    tracing::warn!("Failed to reserve uplink IP {} for {}: {}", dist_ip, dist.hostname, e);
                }

                // Distribution uplink peer vars (from resolved uplink port name)
                let dist_uplink_peer_idx: usize = dist_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(dist_access_port_count + dist_uplink_idx + 1);
                dist_vars[di].push((dist_uplink_peer_idx, core_ip.clone(), core.asn.to_string(), core.hostname.clone(), dist_ip.clone()));

                // Core peer vars: extract port number from resolved port name
                let core_peer_idx: usize = core_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(core_port_idx + 1);
                core_vars[ci].push((core_peer_idx, dist_ip.clone(), dist.asn.to_string(), dist.hostname.clone(), core_ip.clone()));

                fabric_links.push(format!(
                    "{} ({}) <-> {} ({}) [{}]",
                    core.hostname, core_ip, dist.hostname, dist_ip, subnet.prefix
                ));
            }
        }
    }

    // Set variables for core devices
    for (ci, (device_id, node)) in cores.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &core_vars[ci] {
            entries.push((*device_id, format!("Peer{}", idx), peer_ip.clone()));
            entries.push((*device_id, format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((*device_id, format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((*device_id, format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Set variables for distribution devices
    for (di, (device_id, node)) in dists.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &dist_vars[di] {
            entries.push((*device_id, format!("Peer{}", idx), peer_ip.clone()));
            entries.push((*device_id, format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((*device_id, format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((*device_id, format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Set variables for access devices
    for (ai, (device_id, node)) in accesses.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &access_vars[ai] {
            entries.push((*device_id, format!("Peer{}", idx), peer_ip.clone()));
            entries.push((*device_id, format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((*device_id, format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((*device_id, format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Create port assignments for all fabric links
    // Each distribution<->access link creates a port assignment on both sides, routed through the access row's patch panel
    let mut pp_port_counters: HashMap<i64, usize> = HashMap::new();
    for (di, (dist_device_id, dist)) in dists.iter().enumerate() {
        for (ai, (access_device_id, access)) in accesses.iter().enumerate() {
            // Find the patch panel for the access device's row
            let access_pp_id = access.row_id.and_then(|rid| patch_panels.get(&rid)).copied();
            for link in 0..links_per_access as u32 {
                let dist_if = format!("Ethernet{}", ai * links_per_access + link as usize + 1);
                let access_port_idx = di * links_per_access + link as usize;
                let access_100g = model_100g_ports.get(&access.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let access_if = access_100g.get(access_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", access_port_idx + 1));
                // Allocate patch panel ports in pairs: Port N (dist side), Port N+1 (access side)
                let (pp_a_id, pp_a_port, pp_b_id, pp_b_port) = if let Some(pp_id) = access_pp_id {
                    let port_num = pp_port_counters.entry(pp_id).or_insert(0);
                    let a_port_num = *port_num + 1;
                    let b_port_num = *port_num + 2;
                    *port_num += 2;
                    (Some(pp_id), Some(format!("Port {}", a_port_num)), Some(pp_id), Some(format!("Port {}", b_port_num)))
                } else {
                    (None, None, None, None)
                };
                // Cable length estimation for dist<->access link
                let cable_len = estimate_cable_length(
                    find_rack_index(dist.rack_id), dist.rack_position,
                    find_rack_index(access.rack_id), access.rack_position,
                    racks_per_row, row_spacing_cm, cable_slack_percent,
                );
                // Distribution-side port assignment
                let dist_pa = crate::models::SetPortAssignmentRequest {
                    port_name: dist_if.clone(),
                    remote_device_id: Some(*access_device_id),
                    remote_port_name: access_if.clone(),
                    description: Some(format!("{} <-> {} link {}", dist.hostname, access.hostname, link + 1)),
                    patch_panel_a_id: pp_a_id,
                    patch_panel_a_port: pp_a_port.clone(),
                    patch_panel_b_id: pp_b_id,
                    patch_panel_b_port: pp_b_port.clone(),
                    vrf_id: None,
                    cable_length_meters: cable_len,
                };
                if let Err(e) = state.store.set_port_assignment(*dist_device_id, &dist_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", dist_if, dist.hostname, e);
                }
                // Access-side port assignment (reverse direction, swap A/B patch panel ports)
                let access_pa = crate::models::SetPortAssignmentRequest {
                    port_name: access_if,
                    remote_device_id: Some(*dist_device_id),
                    remote_port_name: dist_if,
                    description: Some(format!("{} <-> {} link {}", access.hostname, dist.hostname, link + 1)),
                    patch_panel_a_id: pp_b_id,
                    patch_panel_a_port: pp_b_port,
                    patch_panel_b_id: pp_a_id,
                    patch_panel_b_port: pp_a_port,
                    vrf_id: None,
                    cable_length_meters: cable_len,
                };
                if let Err(e) = state.store.set_port_assignment(*access_device_id, &access_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", access_pa.port_name, access.hostname, e);
                }
            }
        }
    }

    // Core<->distribution port assignments (routed through distribution row's patch panel)
    for (ci, (core_device_id, core)) in cores.iter().enumerate() {
        for (di, (dist_device_id, dist)) in dists.iter().enumerate() {
            let dist_pp_id = dist.row_id.and_then(|rid| patch_panels.get(&rid)).copied();
            for link in 0..uplinks_per_dist {
                let core_port_idx = di * uplinks_per_dist + link;
                let core_100g = model_100g_ports.get(&core.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let core_if = core_100g.get(core_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", core_port_idx + 1));
                let dist_uplink_idx = ci * uplinks_per_dist + link;
                let dist_if = dist_uplink_ports.get(dist_uplink_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", dist_access_port_count + dist_uplink_idx + 1));
                // Cable length estimation for core<->dist link
                let cable_len = estimate_cable_length(
                    find_rack_index(core.rack_id), core.rack_position,
                    find_rack_index(dist.rack_id), dist.rack_position,
                    racks_per_row, row_spacing_cm, cable_slack_percent,
                );

                let (pp_a_id, pp_a_port, pp_b_id, pp_b_port) = if let Some(pp_id) = dist_pp_id {
                    let port_num = pp_port_counters.entry(pp_id).or_insert(0);
                    let a_port_num = *port_num + 1;
                    let b_port_num = *port_num + 2;
                    *port_num += 2;
                    (Some(pp_id), Some(format!("Port {}", a_port_num)), Some(pp_id), Some(format!("Port {}", b_port_num)))
                } else {
                    (None, None, None, None)
                };

                // Core-side
                let core_pa = crate::models::SetPortAssignmentRequest {
                    port_name: core_if.clone(),
                    remote_device_id: Some(*dist_device_id),
                    remote_port_name: dist_if.clone(),
                    description: Some(format!("{} <-> {} uplink {}", core.hostname, dist.hostname, link + 1)),
                    patch_panel_a_id: pp_a_id,
                    patch_panel_a_port: pp_a_port.clone(),
                    patch_panel_b_id: pp_b_id,
                    patch_panel_b_port: pp_b_port.clone(),
                    vrf_id: None,
                    cable_length_meters: cable_len,
                };
                if let Err(e) = state.store.set_port_assignment(*core_device_id, &core_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", core_if, core.hostname, e);
                }
                // Distribution-side (uplink, swap A/B patch panel ports)
                let dist_pa = crate::models::SetPortAssignmentRequest {
                    port_name: dist_if.clone(),
                    remote_device_id: Some(*core_device_id),
                    remote_port_name: core_if,
                    description: Some(format!("{} <-> {} uplink {}", dist.hostname, core.hostname, link + 1)),
                    patch_panel_a_id: pp_b_id,
                    patch_panel_a_port: pp_b_port,
                    patch_panel_b_id: pp_a_id,
                    patch_panel_b_port: pp_a_port,
                    vrf_id: None,
                    cable_length_meters: cable_len,
                };
                if let Err(e) = state.store.set_port_assignment(*dist_device_id, &dist_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", dist_if, dist.hostname, e);
                }
            }
        }
    }

    tracing::info!("Created port assignments for {} patch panels", patch_panels.len());

    // Generate configs
    if let Err(e) = state.config_manager.generate_config().await {
        tracing::warn!("Failed to generate config after hierarchical build: {}", e);
    }

    // Optionally spawn cEOS or FRR containers for each device
    if spawn_containers {
        match bollard::Docker::connect_with_socket_defaults() {
            Ok(docker) => {
                let network_name = get_network_name();

                for (device_id, node) in &created_ids {
                    let container_name = format!("3tier-{}", node.hostname);
                    let mac = result_devices.iter().find(|d| d.hostname == node.hostname)
                        .map(|d| d.mac.clone()).unwrap_or_default();
                    let serial = format!("SN-HIER-{}", node.hostname);

                    let mut labels = HashMap::new();
                    labels.insert("fc-test-client".to_string(), "true".to_string());
                    labels.insert("fc-3tier".to_string(), THREE_TIER_TOPOLOGY_ID.to_string());

                    let mut endpoints = HashMap::new();
                    endpoints.insert(
                        network_name.clone(),
                        bollard::models::EndpointSettings {
                            mac_address: Some(mac.clone()),
                            ..Default::default()
                        },
                    );

                    let config = if use_frr {
                        labels.insert("fc-frr".to_string(), "true".to_string());
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
                            image: Some(ceos_image.clone()),
                            hostname: Some(node.hostname.clone()),
                            env: Some(env),
                            labels: Some(labels),
                            host_config: Some(host_config),
                            networking_config: Some(bollard::container::NetworkingConfig {
                                endpoints_config: endpoints,
                            }),
                            ..Default::default()
                        }
                    } else {
                        labels.insert("fc-ceos".to_string(), "true".to_string());
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
                            image: Some(ceos_image.clone()),
                            hostname: Some(node.hostname.clone()),
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
                        name: container_name.clone(),
                        platform: None,
                    };

                    match docker.create_container(Some(create_options), config).await {
                        Ok(resp) => {
                            // Inject startup-config and modprobe wrapper for cEOS only
                            if !use_frr {
                                let config_content = CEOS_STARTUP_CONFIG
                                    .replace("{hostname}", &node.hostname)
                                    .replace("{serial_number}", &serial);
                                if let Ok(tar_bytes) = build_tar(&[("startup-config", config_content.as_bytes(), 0o644)]) {
                                    let options = bollard::container::UploadToContainerOptions {
                                        path: "/mnt/flash".to_string(),
                                        ..Default::default()
                                    };
                                    let _ = docker.upload_to_container(&resp.id, Some(options), tar_bytes.into()).await;
                                }
                                if let Ok(tar_bytes) = build_tar(&[("modprobe", b"#!/bin/sh\nexit 0\n".as_slice(), 0o755)]) {
                                    let options = bollard::container::UploadToContainerOptions {
                                        path: "/sbin".to_string(),
                                        ..Default::default()
                                    };
                                    let _ = docker.upload_to_container(&resp.id, Some(options), tar_bytes.into()).await;
                                }
                            }

                            // Start container
                            if let Err(e) = docker.start_container::<String>(&resp.id, None).await {
                                tracing::warn!("Failed to start container {}: {}", container_name, e);
                            }

                            // Update result_devices with container name
                            if let Some(rd) = result_devices.iter_mut().find(|d| d.hostname == node.hostname) {
                                rd.container_name = container_name.clone();
                            }

                            // Update device IP from container inspect after start
                            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                            if let Ok(inspect) = docker.inspect_container(&resp.id, None).await {
                                if let Some(ip) = inspect.network_settings.as_ref()
                                    .and_then(|ns| ns.networks.as_ref())
                                    .and_then(|nets| nets.get(&network_name))
                                    .and_then(|net| net.ip_address.clone())
                                {
                                    if !ip.is_empty() {
                                        let _ = state.store.update_device(*device_id, &crate::models::UpdateDeviceRequest {
                                            ip,
                                            hostname: node.hostname.clone(),
                                            vendor: Some(vendor_id.to_string()),
                                            model: Some(node.model.clone()),
                                            serial_number: Some(serial.clone()),
                                            config_template: vendor_base_template_id.clone(),
                                            ssh_user: Some("admin".to_string()),
                                            ssh_pass: Some("admin".to_string()),
                                            topology_id: Some(topo_id),
                                            topology_role: Some(node.role.clone()),
                                            device_type: node.device_type.clone(),
                                            hall_id: node.hall_id,
                                            row_id: node.row_id,
                                            rack_id: node.rack_id,
                                            rack_position: node.rack_position,
                                        }).await;
                                    }
                                }
                            }

                            tracing::info!("Spawned {} container {} for {}", if use_frr { "FRR" } else { "cEOS" }, container_name, node.hostname);
                        }
                        Err(e) => {
                            tracing::warn!("Failed to create container {} for {}: {}", container_name, node.hostname, e);
                        }
                    }
                }

                // Create fabric networks and connect containers
                let core_containers: Vec<(String, String)> = created_ids.iter()
                    .filter(|(_, n)| n.role == "core")
                    .map(|(_, n)| (format!("3tier-{}", n.hostname), n.hostname.clone()))
                    .collect();
                let dist_containers: Vec<(String, String)> = created_ids.iter()
                    .filter(|(_, n)| n.role == "distribution")
                    .map(|(_, n)| (format!("3tier-{}", n.hostname), n.hostname.clone()))
                    .collect();
                let access_containers: Vec<(String, String)> = created_ids.iter()
                    .filter(|(_, n)| n.role == "access")
                    .map(|(_, n)| (format!("3tier-{}", n.hostname), n.hostname.clone()))
                    .collect();

                // Create core<->distribution fabric networks
                for (_, (core_cname, core_host)) in core_containers.iter().enumerate() {
                    for (_, (dist_cname, dist_host)) in dist_containers.iter().enumerate() {
                        for link in 0..uplinks_per_dist {
                            let net_name = format!("3tier-{}-{}-link{}", core_host, dist_host, link + 1);
                            let create_opts = bollard::network::CreateNetworkOptions {
                                name: net_name.clone(),
                                driver: "bridge".to_string(),
                                labels: {
                                    let mut l = HashMap::new();
                                    l.insert("fc-3tier".to_string(), THREE_TIER_TOPOLOGY_ID.to_string());
                                    l
                                },
                                ..Default::default()
                            };
                            if let Err(e) = docker.create_network(create_opts).await {
                                tracing::warn!("Failed to create fabric network {}: {}", net_name, e);
                                continue;
                            }
                            let core_connect = bollard::network::ConnectNetworkOptions {
                                container: core_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, core_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", core_cname, net_name, e);
                            }
                            let dist_connect = bollard::network::ConnectNetworkOptions {
                                container: dist_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, dist_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", dist_cname, net_name, e);
                            }
                        }
                    }
                }

                // Create distribution<->access fabric networks
                for (_, (dist_cname, dist_host)) in dist_containers.iter().enumerate() {
                    for (_, (access_cname, access_host)) in access_containers.iter().enumerate() {
                        for link in 0..links_per_access as u32 {
                            let net_name = format!("3tier-{}-{}-link{}", dist_host, access_host, link + 1);
                            let create_opts = bollard::network::CreateNetworkOptions {
                                name: net_name.clone(),
                                driver: "bridge".to_string(),
                                labels: {
                                    let mut l = HashMap::new();
                                    l.insert("fc-3tier".to_string(), THREE_TIER_TOPOLOGY_ID.to_string());
                                    l
                                },
                                ..Default::default()
                            };
                            if let Err(e) = docker.create_network(create_opts).await {
                                tracing::warn!("Failed to create fabric network {}: {}", net_name, e);
                                continue;
                            }
                            let dist_connect = bollard::network::ConnectNetworkOptions {
                                container: dist_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, dist_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", dist_cname, net_name, e);
                            }
                            let access_connect = bollard::network::ConnectNetworkOptions {
                                container: access_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, access_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", access_cname, net_name, e);
                            }
                        }
                    }
                }

                // For FRR: configure BGP via docker exec after containers and networks are ready
                if use_frr {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    configure_frr_bgp_3tier(&docker, &created_ids, &core_vars, &dist_vars, &access_vars).await;
                }
            }
            Err(e) => {
                tracing::warn!("Docker not available for container spawning: {}", e);
            }
        }
    }

    // Create GPU clusters, GPU node devices, and port assignments
    if req.gpu_cluster_count > 0 {
        let access_created: Vec<(i64, &VNode)> = created_ids.iter()
            .filter(|(_, n)| n.role == "access")
            .map(|(id, n)| (*id, n))
            .collect();
        let total_access = access_created.len().max(1);
        let gpu_model_name = format!("{} 8-GPU Node", req.gpu_model);
        let topology_slug = topo_name.to_lowercase().replace(' ', "-");
        let mut gpu_counter: usize = 0;

        for ci in 0..req.gpu_cluster_count {
            let cluster_vrf_id = req.gpu_vrf_ids.get(ci).copied().filter(|&id| id > 0);
            let cluster_name = format!("{}-gpu-{}", topology_slug, ci + 1);
            let description = format!(
                "{} x {} ({} GPUs/node), {} interconnect — striped across {} access switches",
                req.gpu_nodes_per_cluster, req.gpu_model, req.gpus_per_node,
                req.gpu_interconnect, total_access.min(req.gpu_nodes_per_cluster)
            );
            let gpu_req = crate::models::CreateGpuClusterRequest {
                name: cluster_name.clone(),
                description: Some(description),
                gpu_model: req.gpu_model.clone(),
                node_count: req.gpu_nodes_per_cluster as i32,
                gpus_per_node: req.gpus_per_node as i32,
                interconnect_type: req.gpu_interconnect.clone(),
                status: "provisioning".to_string(),
                topology_id: Some(topo_id),
                vrf_id: cluster_vrf_id,
            };
            match state.store.create_gpu_cluster(&gpu_req).await {
                Ok(cluster) => {
                    tracing::info!("Created GPU cluster {} (id={}) for topology {}", cluster.name, cluster.id, topo_id);
                }
                Err(e) => {
                    tracing::warn!("Failed to create GPU cluster: {}", e);
                }
            }

            // Create GPU node Device records
            let mut gpu_device_ids: Vec<i64> = Vec::new();
            for ni in 0..req.gpu_nodes_per_cluster {
                let access_idx = (ci * req.gpu_nodes_per_cluster + ni) % total_access;
                let (_, access_node) = &access_created[access_idx];
                gpu_counter += 1;
                let hall_str = access_node.hall_id.map(|id| id.to_string()).unwrap_or_default();
                let gpu_hostname = resolve_hostname(hostname_pattern, dc, region, &hall_str, "gpu-node", gpu_counter);
                let final_rack_pos = access_node.rack_position.map(|p| p + 4 + (ni as i32 * 4));

                let dev_req = crate::models::CreateDeviceRequest {
                    mac: generate_mac(),
                    ip: format!("172.20.6.{}", 10 + ci * req.gpu_nodes_per_cluster + ni + 1),
                    hostname: gpu_hostname.clone(),
                    vendor: Some("amd".to_string()),
                    model: Some(gpu_model_name.clone()),
                    serial_number: Some(format!("SN-GPU-{}", gpu_hostname)),
                    config_template: String::new(),
                    ssh_user: None,
                    ssh_pass: None,
                    topology_id: Some(topo_id),
                    topology_role: Some("gpu-node".to_string()),
                    device_type: Some("internal".to_string()),
                    hall_id: access_node.hall_id,
                    row_id: access_node.row_id,
                    rack_id: access_node.rack_id,
                    rack_position: final_rack_pos,
                };
                match state.store.create_device(&dev_req).await {
                    Ok(dev) => {
                        gpu_device_ids.push(dev.id);
                        result_devices.push(TopologyBuildDevice {
                            hostname: gpu_hostname.clone(),
                            role: "gpu-node".to_string(),
                            mac: dev_req.mac,
                            ip: dev_req.ip,
                            container_name: String::new(),
                        });
                    }
                    Err(e) => {
                        tracing::warn!("Failed to create GPU node device {}: {}", gpu_hostname, e);
                        gpu_device_ids.push(0);
                    }
                }
            }

            // Create leaf uplink port assignments
            if req.gpu_include_leaf_uplinks {
                for ni in 0..req.gpu_nodes_per_cluster {
                    let gpu_dev_id = gpu_device_ids[ni];
                    if gpu_dev_id == 0 { continue; }
                    let access_idx = (ci * req.gpu_nodes_per_cluster + ni) % total_access;
                    let (access_dev_id, access_node) = &access_created[access_idx];
                    let hall_str = access_node.hall_id.map(|id| id.to_string()).unwrap_or_default();
                    let gpu_node_idx = gpu_counter - req.gpu_nodes_per_cluster + ni + 1;
                    let gpu_host = resolve_hostname(hostname_pattern, dc, region, &hall_str, "gpu-node", gpu_node_idx);

                    for ul in 0..2usize {
                        let gpu_port = format!("Ethernet{}", ul + 1);
                        let access_port = format!("Ethernet{}", 33 + ci * req.gpu_nodes_per_cluster * 2 + ni * 2 + ul);
                        let cable_len = estimate_cable_length(
                            access_node.rack_id.map(|_| access_idx), access_node.rack_position,
                            access_node.rack_id.map(|_| access_idx), access_node.rack_position.map(|p| p + 4 + (ni as i32 * 4)),
                            racks_per_row, row_spacing_cm, cable_slack_percent,
                        );

                        let gpu_pa = crate::models::SetPortAssignmentRequest {
                            port_name: gpu_port.clone(),
                            remote_device_id: Some(*access_dev_id),
                            remote_port_name: access_port.clone(),
                            description: Some(format!("GPU uplink to {}", access_node.hostname)),
                            patch_panel_a_id: None,
                            patch_panel_a_port: None,
                            patch_panel_b_id: None,
                            patch_panel_b_port: None,
                            vrf_id: cluster_vrf_id,
                            cable_length_meters: cable_len,
                        };
                        if let Err(e) = state.store.set_port_assignment(gpu_dev_id, &gpu_pa).await {
                            tracing::warn!("Failed to create GPU uplink port assignment: {}", e);
                        }

                        let access_pa = crate::models::SetPortAssignmentRequest {
                            port_name: access_port,
                            remote_device_id: Some(gpu_dev_id),
                            remote_port_name: gpu_port,
                            description: Some(format!("GPU node {} uplink", gpu_host)),
                            patch_panel_a_id: None,
                            patch_panel_a_port: None,
                            patch_panel_b_id: None,
                            patch_panel_b_port: None,
                            vrf_id: cluster_vrf_id,
                            cable_length_meters: cable_len,
                        };
                        if let Err(e) = state.store.set_port_assignment(*access_dev_id, &access_pa).await {
                            tracing::warn!("Failed to create access GPU port assignment: {}", e);
                        }
                    }
                }
            }

            // Create GPU fabric port assignments (full mesh)
            if req.gpu_include_fabric_cabling && req.gpu_nodes_per_cluster > 1 {
                let is_ib = req.gpu_interconnect == "InfiniBand" || req.gpu_interconnect == "InfinityFabric";
                let mut port_counters: Vec<usize> = vec![0; req.gpu_nodes_per_cluster];
                for a in 0..req.gpu_nodes_per_cluster {
                    for b in (a + 1)..req.gpu_nodes_per_cluster {
                        let a_port_idx = port_counters[a];
                        let b_port_idx = port_counters[b];
                        port_counters[a] += 1;
                        port_counters[b] += 1;

                        let a_if = if is_ib { format!("IB{}", a_port_idx + 1) } else { format!("Ethernet{}", a_port_idx + 3) };
                        let b_if = if is_ib { format!("IB{}", b_port_idx + 1) } else { format!("Ethernet{}", b_port_idx + 3) };

                        let a_dev_id = gpu_device_ids[a];
                        let b_dev_id = gpu_device_ids[b];
                        if a_dev_id == 0 || b_dev_id == 0 { continue; }

                        let a_pa = crate::models::SetPortAssignmentRequest {
                            port_name: a_if.clone(),
                            remote_device_id: Some(b_dev_id),
                            remote_port_name: b_if.clone(),
                            description: Some("GPU fabric link".to_string()),
                            patch_panel_a_id: None,
                            patch_panel_a_port: None,
                            patch_panel_b_id: None,
                            patch_panel_b_port: None,
                            vrf_id: None,
                            cable_length_meters: None,
                        };
                        if let Err(e) = state.store.set_port_assignment(a_dev_id, &a_pa).await {
                            tracing::warn!("Failed to create GPU fabric port assignment: {}", e);
                        }

                        let b_pa = crate::models::SetPortAssignmentRequest {
                            port_name: b_if,
                            remote_device_id: Some(a_dev_id),
                            remote_port_name: a_if,
                            description: Some("GPU fabric link".to_string()),
                            patch_panel_a_id: None,
                            patch_panel_a_port: None,
                            patch_panel_b_id: None,
                            patch_panel_b_port: None,
                            vrf_id: None,
                            cable_length_meters: None,
                        };
                        if let Err(e) = state.store.set_port_assignment(b_dev_id, &b_pa).await {
                            tracing::warn!("Failed to create GPU fabric port assignment: {}", e);
                        }
                    }
                }
            }
        }
    }

    // Create management switch port assignments (OOB mgmt ports)
    {
        let mut mgmt_port_counters: HashMap<i64, usize> = HashMap::new();
        for (dev_id, node) in &created_ids {
            if node.role == "patch-panel" || node.device_type.as_deref() == Some("external") || node.role == "mgmt-switch" {
                continue;
            }
            let row_id = match node.row_id { Some(r) => r, None => continue };
            let rack_id = node.rack_id;

            let matching: Vec<i64> = mgmt_switches.iter()
                .filter(|(_, ms_row, ms_rack, _)| {
                    if *ms_row != row_id { return false; }
                    if let Some(mr) = ms_rack { rack_id == Some(*mr) } else { true }
                })
                .map(|(_, _, _, dev)| *dev)
                .collect();

            if matching.is_empty() { continue; }

            let mgmt_switch_id = *matching.iter()
                .min_by_key(|&&id| mgmt_port_counters.get(&id).copied().unwrap_or(0))
                .unwrap();

            let port_num = mgmt_port_counters.entry(mgmt_switch_id).or_insert(0);
            *port_num += 1;
            let pn = *port_num;

            let mgmt_pa = crate::models::SetPortAssignmentRequest {
                port_name: format!("Ethernet{}", pn),
                remote_device_id: Some(*dev_id),
                remote_port_name: "Management0".to_string(),
                description: Some(format!("OOB management: {}", node.hostname)),
                patch_panel_a_id: None,
                patch_panel_a_port: None,
                patch_panel_b_id: None,
                patch_panel_b_port: None,
                vrf_id: None,
                cable_length_meters: None,
            };
            if let Err(e) = state.store.set_port_assignment(mgmt_switch_id, &mgmt_pa).await {
                tracing::warn!("Failed to create mgmt switch port assignment for {}: {}", node.hostname, e);
            }

            let dev_pa = crate::models::SetPortAssignmentRequest {
                port_name: "Management0".to_string(),
                remote_device_id: Some(mgmt_switch_id),
                remote_port_name: format!("Ethernet{}", pn),
                description: Some("OOB management uplink".to_string()),
                patch_panel_a_id: None,
                patch_panel_a_port: None,
                patch_panel_b_id: None,
                patch_panel_b_port: None,
                vrf_id: None,
                cable_length_meters: None,
            };
            if let Err(e) = state.store.set_port_assignment(*dev_id, &dev_pa).await {
                tracing::warn!("Failed to create device mgmt port assignment for {}: {}", node.hostname, e);
            }
        }
    }

    Ok(Json(TopologyBuildResponse {
        topology_id: topo_id,
        topology_name: topo_name,
        devices: result_devices,
        fabric_links,
    }))
}

/// Configure BGP on FRR containers for hierarchical topology via docker exec (vtysh)
async fn configure_frr_bgp_3tier(
    docker: &bollard::Docker,
    created_ids: &[(i64, VNode)],
    core_vars: &[Vec<(usize, String, String, String, String)>],
    dist_vars: &[Vec<(usize, String, String, String, String)>],
    access_vars: &[Vec<(usize, String, String, String, String)>],
) {
    let cores: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "core").collect();
    let dists: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "distribution").collect();
    let accesses: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "access").collect();

    async fn configure_one(docker: &bollard::Docker, hostname: &str, loopback: &str, asn: u32, peers: &[(usize, String, String, String, String)]) {
        let container_name = format!("3tier-{}", hostname);
        let mut cmds = vec![
            "configure terminal".to_string(),
            "interface lo".to_string(),
            format!(" ip address {}/32", loopback),
            "exit".to_string(),
            format!("router bgp {}", asn),
            format!(" bgp router-id {}", loopback),
            " no bgp ebgp-requires-policy".to_string(),
            " no bgp network import-check".to_string(),
        ];
        for (_idx, peer_ip, peer_asn, _peer_name, _local_addr) in peers {
            cmds.push(format!(" neighbor {} remote-as {}", peer_ip, peer_asn));
        }
        cmds.push(" address-family ipv4 unicast".to_string());
        cmds.push("  redistribute connected".to_string());
        cmds.push(" exit-address-family".to_string());
        cmds.push("end".to_string());
        cmds.push("write memory".to_string());

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
        match docker.create_exec(&container_name, exec_config).await {
            Ok(exec) => {
                let start_config = bollard::exec::StartExecOptions { detach: false, ..Default::default() };
                match docker.start_exec(&exec.id, Some(start_config)).await {
                    Ok(_) => tracing::info!("Configured BGP on {} (AS {})", hostname, asn),
                    Err(e) => tracing::warn!("Failed to start exec on {}: {}", hostname, e),
                }
            }
            Err(e) => tracing::warn!("Failed to create exec on {}: {}", hostname, e),
        }
    }

    for (ci, (_, node)) in cores.iter().enumerate() {
        if let Some(vars) = core_vars.get(ci) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
    for (di, (_, node)) in dists.iter().enumerate() {
        if let Some(vars) = dist_vars.get(di) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
    for (ai, (_, node)) in accesses.iter().enumerate() {
        if let Some(vars) = access_vars.get(ai) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
}

/// Teardown hierarchical (3-tier) topology
pub async fn teardown_three_tier(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    teardown_three_tier_inner(&state).await;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn teardown_three_tier_inner(state: &Arc<AppState>) {
    // Remove any spawned containers (labeled fc-3tier)
    if let Ok(docker) = bollard::Docker::connect_with_socket_defaults() {
        let mut filters = HashMap::new();
        filters.insert("label".to_string(), vec![format!("fc-3tier={}", THREE_TIER_TOPOLOGY_ID)]);
        let options = bollard::container::ListContainersOptions {
            all: true,
            filters,
            ..Default::default()
        };
        if let Ok(containers) = docker.list_containers(Some(options)).await {
            for container in &containers {
                if let Some(id) = &container.id {
                    let _ = docker.stop_container(id, None).await;
                    let opts = bollard::container::RemoveContainerOptions { force: true, ..Default::default() };
                    let _ = docker.remove_container(id, Some(opts)).await;
                    tracing::info!("Removed hierarchical container {}", id);
                }
            }
        }
        // Clean up fabric networks (labeled fc-3tier)
        let mut net_filters = HashMap::new();
        net_filters.insert("label".to_string(), vec![format!("fc-3tier={}", THREE_TIER_TOPOLOGY_ID)]);
        let net_opts = bollard::network::ListNetworksOptions { filters: net_filters };
        if let Ok(networks) = docker.list_networks(Some(net_opts)).await {
            for net in &networks {
                if let Some(id) = &net.id {
                    let _ = docker.remove_network(id).await;
                    tracing::info!("Removed hierarchical network {}", net.name.as_deref().unwrap_or(id));
                }
            }
        }
    }

    // Find the topology by name to get its numeric ID for device cleanup
    let topos = state.store.list_topologies().await.unwrap_or_default();
    let hier_topo = topos.iter().find(|t| t.name == THREE_TIER_TOPOLOGY_NAME);
    if let Some(topo) = hier_topo {
        let deleted = state.store.delete_devices_by_topology(topo.id).await.unwrap_or(0);
        if deleted > 0 {
            tracing::info!("Deleted {} hierarchical devices", deleted);
        }
    }

    // Clean up IPAM: delete /31 prefixes under the P2P pool and loopback pool
    // Also delete IP addresses (cascade from prefix deletion)
    if let Ok(Some(p2p_pool)) = state.store.find_ipam_prefix_by_cidr(THREE_TIER_P2P_CIDR, None).await {
        // Delete all child /31 prefixes under the P2P pool
        if let Ok(all_prefixes) = state.store.list_ipam_prefixes().await {
            for prefix in all_prefixes.iter().filter(|p| p.parent_id == Some(p2p_pool.id)) {
                let _ = state.store.delete_ipam_prefix(prefix.id).await;
            }
        }
        // Delete the P2P pool itself
        let _ = state.store.delete_ipam_prefix(p2p_pool.id).await;
    }
    if let Ok(Some(lo_pool)) = state.store.find_ipam_prefix_by_cidr(THREE_TIER_LOOPBACK_CIDR, None).await {
        // Delete IP addresses under loopback pool (they won't cascade from prefix deletion since they're direct children)
        if let Ok(ips) = state.store.list_ipam_ip_addresses_by_prefix(lo_pool.id).await {
            for ip in &ips {
                let _ = state.store.delete_ipam_ip_address(ip.id).await;
            }
        }
        // Delete the loopback pool itself
        let _ = state.store.delete_ipam_prefix(lo_pool.id).await;
    }

    let _ = state.store.delete_topology_by_name(THREE_TIER_TOPOLOGY_NAME).await;

    // Clean up auto-created org entities (matched by description)
    // Delete in reverse order: racks, rows, halls
    let hier_desc = "Auto-created by Hierarchical Build";
    if let Ok(racks) = state.store.list_ipam_racks().await {
        for rack in racks.iter().filter(|r| r.description.as_deref().map_or(false, |d| d.starts_with(hier_desc))) {
            let _ = state.store.delete_ipam_rack(rack.id).await;
        }
    }
    if let Ok(rows) = state.store.list_ipam_rows().await {
        for row in rows.iter().filter(|r| r.description.as_deref().map_or(false, |d| d.starts_with(hier_desc))) {
            let _ = state.store.delete_ipam_row(row.id).await;
        }
    }
    if let Ok(halls) = state.store.list_ipam_halls().await {
        for hall in halls.iter().filter(|h| h.description.as_deref().map_or(false, |d| d.starts_with(hier_desc))) {
            let _ = state.store.delete_ipam_hall(hall.id).await;
        }
    }
}
