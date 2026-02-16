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
// CLOS topology builder — spines, leaves, externals with racks/IPAM/patch panels
// Optionally spawns cEOS or FRR containers when spawn_containers is set
// ─────────────────────────────────────────────────────────────────────────────

const VIRTUAL_CLOS_TOPOLOGY_ID: &str = "dc1-virtual";
const VIRTUAL_CLOS_TOPOLOGY_NAME: &str = "DC1 Virtual Fabric";
const VIRTUAL_CLOS_P2P_CIDR: &str = "10.1.0.0/16";
const VIRTUAL_CLOS_LOOPBACK_CIDR: &str = "10.255.0.0/16";
const VIRTUAL_CLOS_P2P_PARENT_CIDR: &str = "10.0.0.0/8";

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

/// Build a 4-spine / 16-leaf virtual CLOS topology (device records only)
pub async fn build_virtual_clos(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
    Json(req): Json<VirtualClosRequest>,
) -> Result<Json<ClosLabResponse>, ApiError> {
    // Teardown any existing virtual CLOS first
    teardown_virtual_clos_inner(&state).await;

    let spine_count = req.spines;
    let leaf_count = req.leaves;
    let hall_count = req.halls;
    let rows_per_hall = req.rows_per_hall;
    let racks_per_row = req.racks_per_row;
    let leaves_per_rack = req.leaves_per_rack;
    let external_count = req.external_devices;
    let uplinks_per_spine = req.uplinks_per_spine;
    let links_per_leaf = req.links_per_leaf;
    let spine_model = if req.spine_model.is_empty() { "7050CX3-32S".to_string() } else { req.spine_model.clone() };
    let leaf_model = if req.leaf_model.is_empty() { "7050SX3-48YC8".to_string() } else { req.leaf_model.clone() };
    let datacenter_id = req.datacenter_id;
    let dc = datacenter_id.map(|id| id.to_string()).unwrap_or_default();
    let dc = dc.as_str();
    let region = req.region_id.map(|id| id.to_string()).unwrap_or_default();
    let region = region.as_str();

    // Load hostname pattern from settings
    let settings = state.store.get_settings().await.unwrap_or_default();
    let hostname_pattern = &settings.hostname_pattern;

    let spawn_containers = req.spawn_containers;
    let ceos_image = if req.ceos_image.is_empty() {
        std::env::var("CEOS_IMAGE").unwrap_or_else(|_| "ceosimage:latest".to_string())
    } else {
        req.ceos_image.clone()
    };

    // Detect vendor from image (FRR vs Arista)
    let use_frr = spawn_containers && is_frr_image(&ceos_image);
    let vendor_id = if use_frr { "frr" } else { "arista" };

    // Look up device roles to resolve config_template + group_names per topology role
    let mut role_templates: HashMap<String, String> = HashMap::new();
    let mut role_group_names: HashMap<String, Vec<String>> = HashMap::new();
    for role_name in ["spine", "leaf", "external"] {
        let device_role_name = format!("{}-{}", vendor_id, role_name);
        if let Ok(Some(role)) = state.store.find_device_role_by_name(&device_role_name).await {
            if let Some(tnames) = &role.template_names {
                if let Some(first) = tnames.first() {
                    // Derive base template: "arista-eos-leaf" → "arista-eos"
                    let base = first.strip_suffix(&format!("-{}", role_name))
                        .unwrap_or(first);
                    role_templates.insert(role_name.to_string(), base.to_string());
                }
            }
            if !role.group_names.is_empty() {
                role_group_names.insert(role_name.to_string(), role.group_names.clone());
            }
        }
    }

    // Create topology
    let topo_req = crate::models::CreateTopologyRequest {
        name: VIRTUAL_CLOS_TOPOLOGY_NAME.to_string(),
        description: Some(if external_count > 0 {
            format!("{}-spine / {}-leaf / {}-external Arista virtual fabric", spine_count, leaf_count, external_count)
        } else {
            format!("{}-spine / {}-leaf Arista virtual fabric", spine_count, leaf_count)
        }),
        region_id: req.region_id,
        campus_id: req.campus_id,
        datacenter_id: req.datacenter_id,
    };
    let topo_id_str = match state.store.create_topology(&topo_req).await {
        Ok(t) => t.id.to_string(),
        Err(e) => {
            tracing::warn!("Failed to create virtual topology: {}", e);
            String::new()
        }
    };

    // Auto-create org hierarchy (halls/rows/racks) when datacenter is provided
    // Each rack entry: (hall_id, row_id, rack_id)
    let mut rack_placements: Vec<(i64, i64, i64)> = Vec::new();
    // Spine racks: one per row, spines distributed round-robin across rows
    let mut spine_racks: Vec<(i64, i64, i64)> = Vec::new();
    // Map row_id -> patch panel device ID for port assignment wiring
    let mut patch_panels: HashMap<i64, i64> = HashMap::new();

    if let Some(dc_id) = datacenter_id {
        for h in 1..=hall_count {
            let hall_req = crate::models::CreateIpamHallRequest {
                name: format!("Hall {}", h),
                description: Some("Auto-created by Virtual CLOS".to_string()),
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
                    description: Some("Auto-created by Virtual CLOS".to_string()),
                    hall_id,
                };
                let row_id = match state.store.create_ipam_row(&row_req).await {
                    Ok(row) => row.id,
                    Err(e) => {
                        tracing::warn!("Failed to create row hall-{}-row-{}: {}", h, r, e);
                        continue;
                    }
                };

                // Create leaf racks with spine rack in the middle of the row
                let mid = racks_per_row / 2; // e.g., 8 racks → spine after rack 4
                for k in 1..=racks_per_row {
                    // Insert spine rack at the midpoint
                    if k == mid + 1 {
                        let spine_rack_req = crate::models::CreateIpamRackRequest {
                            name: format!("Hall {} Row {} Spine Rack", h, r),
                            description: Some("Auto-created by Virtual CLOS — spine switches".to_string()),
                            row_id,
                        };
                        match state.store.create_ipam_rack(&spine_rack_req).await {
                            Ok(rack) => {
                                spine_racks.push((hall_id, row_id, rack.id));
                            }
                            Err(e) => {
                                tracing::warn!("Failed to create spine rack: {}", e);
                            }
                        }
                    }

                    let rack_req = crate::models::CreateIpamRackRequest {
                        name: format!("Hall {} Row {} Rack {}", h, r, k),
                        description: Some("Auto-created by Virtual CLOS".to_string()),
                        row_id,
                    };
                    match state.store.create_ipam_rack(&rack_req).await {
                        Ok(rack) => {
                            rack_placements.push((hall_id, row_id, rack.id));
                        }
                        Err(e) => {
                            tracing::warn!("Failed to create rack hall-{}-row-{}-rack-{}: {}", h, r, k, e);
                        }
                    }
                }

                // Create a patch panel device for this row
                let pp_hostname = format!("vclos-hall-{}-row-{}-pp", h, r);
                let pp_req = crate::models::CreateDeviceRequest {
                    mac: String::new(),
                    ip: String::new(),
                    hostname: pp_hostname.clone(),
                    vendor: Some("patch-panel".to_string()),
                    model: Some("PP-192-RJ45".to_string()),
                    serial_number: Some(format!("SN-VCLOS-{}", pp_hostname)),
                    config_template: String::new(),
                    ssh_user: None,
                    ssh_pass: None,
                    topology_id: Some(topo_id_str.clone()),
                    topology_role: None,
                    device_type: Some("external".to_string()),
                    hall_id: Some(hall_id),
                    row_id: Some(row_id),
                    rack_id: None,
                    rack_position: None,
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

    // Build node list: spines + leaves + externals

    let mut nodes: Vec<VNode> = Vec::new();

    // Spines: use spine_model from request (default: 7050CX3-32S)
    // Distribute spines round-robin across rows (one spine rack per row)
    for i in 1..=spine_count {
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
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "spine", i),
            role: "spine".to_string(),
            loopback: format!("10.255.0.{}", i),
            asn: 65000,
            model: spine_model.clone(),
            mgmt_ip: format!("172.20.0.{}", 10 + i),
            hall_id: h,
            row_id: r,
            rack_id: rk,
            rack_position: pos,
            device_type: None,
        });
    }

    // Leaves: use leaf_model from request (default: 7050SX3-48YC8)
    // Distribute across racks: leaves_per_rack per rack
    for i in 1..=leaf_count {
        let (h, r, rk, pos) = if !rack_placements.is_empty() {
            let rack_idx = (i - 1) / leaves_per_rack;
            let pos_in_rack = ((i - 1) % leaves_per_rack) as i32 + 1;
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
            hostname: resolve_hostname(hostname_pattern, dc, region, &hall_name, "leaf", i),
            role: "leaf".to_string(),
            loopback: format!("10.255.1.{}", i),
            asn: 65000 + i as u32,
            model: leaf_model.clone(),
            mgmt_ip: format!("172.20.1.{}", 10 + i),
            hall_id: h,
            row_id: r,
            rack_id: rk,
            rack_position: pos,
            device_type: None,
        });
    }

    // External devices (uplink routers) — not assigned to any rack
    let external_names = req.external_names;
    for i in 1..=external_count {
        let hostname = external_names.get(i - 1)
            .filter(|n| !n.is_empty())
            .cloned()
            .unwrap_or_else(|| resolve_hostname(hostname_pattern, dc, region, "", "external", i));
        nodes.push(VNode {
            hostname,
            role: "external".to_string(),
            loopback: format!("10.255.2.{}", i),
            asn: 64999_u32.saturating_sub(i as u32 - 1),
            model: "7280R3".to_string(),
            mgmt_ip: format!("172.20.2.{}", 10 + i),
            hall_id: None,
            row_id: None,
            rack_id: None,
            rack_position: None,
            device_type: Some("external".to_string()),
        });
    }

    // Create device records + collect results
    let mut result_devices = Vec::new();
    let mut created_ids: Vec<(i64, VNode)> = Vec::new();

    for node in nodes {
        let mac = if use_frr { generate_mac() } else { generate_arista_mac() };
        let serial = format!("SN-VCLOS-{}", node.hostname);

        let dev_req = crate::models::CreateDeviceRequest {
            mac: mac.clone(),
            ip: node.mgmt_ip.clone(),
            hostname: node.hostname.clone(),
            vendor: Some(vendor_id.to_string()),
            model: Some(node.model.to_string()),
            serial_number: Some(serial),
            config_template: role_templates.get(&node.role).cloned().unwrap_or_default(),
            ssh_user: Some("admin".to_string()),
            ssh_pass: Some("admin".to_string()),
            topology_id: Some(topo_id_str.clone()),
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

    // Ensure P2P prefix pool exists in IPAM (10.1.0.0/16 under parent supernet)
    let p2p_pool = match state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_P2P_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: VIRTUAL_CLOS_P2P_CIDR.to_string(),
                description: Some("Fabric P2P link pool".to_string()),
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

    // Ensure Loopback prefix pool exists in IPAM (10.255.0.0/16 under parent supernet)
    let loopback_pool = match state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_LOOPBACK_CIDR, None).await? {
        Some(p) => p,
        None => {
            let req = crate::models::CreateIpamPrefixRequest {
                prefix: VIRTUAL_CLOS_LOOPBACK_CIDR.to_string(),
                description: Some("Loopback address pool".to_string()),
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
    // Each spine-leaf pair gets links_per_leaf point-to-point /31 links
    // Spine side = network address (even), Leaf side = broadcast address (odd)
    let spines: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "spine").collect();
    let leaves: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "leaf").collect();
    let externals: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "external").collect();

    // spine_vars[spine_idx] = Vec of (peer_idx, peer_ip, peer_asn, peer_name, local_addr)
    let mut spine_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); spines.len()];
    let mut leaf_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); leaves.len()];
    let mut external_vars: Vec<Vec<(usize, String, String, String, String)>> = vec![Vec::new(); externals.len()];
    let mut fabric_links = Vec::new();

    // Load device models to dynamically resolve port names by speed.
    // Fabric links require 100G ports — look up the actual port names from each model's layout.
    let all_models = state.store.list_device_models().await
        .map_err(|e| ApiError::internal(format!("Failed to load device models: {}", e)))?;
    let model_100g_ports: HashMap<String, Vec<String>> = all_models.iter()
        .map(|m| (m.model.clone(), get_ports_by_min_speed(&m.layout, 100_000)))
        .collect();

    // Split spine 100G ports: first 2/3 for leaf-facing, last 1/3 for uplinks
    let spine_all_ports = model_100g_ports.get(&spine_model).cloned().unwrap_or_default();
    let spine_leaf_port_count = (spine_all_ports.len() * 2 + 2) / 3; // ceil(2/3)
    let spine_leaf_ports: Vec<String> = spine_all_ports.iter().take(spine_leaf_port_count).cloned().collect();
    let spine_uplink_ports: Vec<String> = spine_all_ports.iter().skip(spine_leaf_port_count).cloned().collect();

    for (si, (spine_device_id, spine)) in spines.iter().enumerate() {
        for (li, (leaf_device_id, leaf)) in leaves.iter().enumerate() {
            for link in 0..links_per_leaf as u32 {
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

                // Reserve spine-side IP address in IPAM (spine uses first 2/3 of 100G ports for leaves)
                let spine_port_idx = li * links_per_leaf + link as usize;
                let spine_if_name = spine_leaf_ports.get(spine_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", spine_port_idx + 1));
                let spine_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: spine_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", spine.hostname, spine_if_name, leaf.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*spine_device_id),
                    interface_name: Some(spine_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&spine_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", spine_ip, spine.hostname, e);
                }

                // Reserve leaf-side IP address in IPAM (leaf uses 100G ports for spine uplinks)
                let leaf_port_idx = si * links_per_leaf + link as usize;
                let leaf_100g = model_100g_ports.get(&leaf.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let leaf_if_name = leaf_100g.get(leaf_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", leaf_port_idx + 1));
                // Extract port number from the resolved port name for peer variable keys
                let leaf_peer_idx: usize = leaf_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(leaf_port_idx + 1);
                let leaf_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: leaf_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", leaf.hostname, leaf_if_name, spine.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*leaf_device_id),
                    interface_name: Some(leaf_if_name),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&leaf_ip_req).await {
                    tracing::warn!("Failed to reserve P2P IP {} for {}: {}", leaf_ip, leaf.hostname, e);
                }

                // Spine peer index: extract port number from resolved port name
                let spine_peer_idx: usize = spine_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(spine_port_idx + 1);
                spine_vars[si].push((spine_peer_idx, leaf_ip.clone(), leaf.asn.to_string(), leaf.hostname.clone(), spine_ip.clone()));
                leaf_vars[li].push((leaf_peer_idx, spine_ip.clone(), spine.asn.to_string(), spine.hostname.clone(), leaf_ip.clone()));

                fabric_links.push(format!(
                    "{} ({}) <-> {} ({}) [{}]",
                    spine.hostname, spine_ip, leaf.hostname, leaf_ip, subnet.prefix
                ));
            }
        }
    }

    // Build uplink fabric links: each external device connects to every spine
    // with uplinks_per_spine links per spine
    for (ei, (ext_device_id, ext)) in externals.iter().enumerate() {
        for (si, (spine_device_id, spine)) in spines.iter().enumerate() {
            for link in 0..uplinks_per_spine {
                let alloc_req = crate::models::NextAvailablePrefixRequest {
                    prefix_length: 31,
                    description: Some(format!("{} <-> {} uplink {}", ext.hostname, spine.hostname, link + 1)),
                    status: "active".to_string(),
                    datacenter_id: None,
                };
                let subnet = state.store.next_available_ipam_prefix(p2p_pool.id, &alloc_req).await
                    .map_err(|e| ApiError::internal(format!("Failed to allocate uplink /31: {}", e)))?;

                let net = subnet.network_int as u32;
                let ext_ip = crate::utils::u32_to_ipv4(net);
                let spine_ip = crate::utils::u32_to_ipv4(net + 1);

                // External device interface (100G ports from model layout)
                let ext_port_idx = si * uplinks_per_spine + link;
                let ext_100g = model_100g_ports.get(&ext.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let ext_if_name = ext_100g.get(ext_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", ext_port_idx + 1));
                let ext_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: ext_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", ext.hostname, ext_if_name, spine.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*ext_device_id),
                    interface_name: Some(ext_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&ext_ip_req).await {
                    tracing::warn!("Failed to reserve uplink IP {} for {}: {}", ext_ip, ext.hostname, e);
                }

                // Spine uplink interface (last 1/3 of 100G ports)
                let spine_uplink_idx = ei * uplinks_per_spine + link;
                let spine_if_name = spine_uplink_ports.get(spine_uplink_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", spine_leaf_port_count + spine_uplink_idx + 1));
                let spine_ip_req = crate::models::CreateIpamIpAddressRequest {
                    address: spine_ip.clone(),
                    prefix_id: subnet.id,
                    description: Some(format!("{} {} -> {}", spine.hostname, spine_if_name, ext.hostname)),
                    status: "active".to_string(),
                    role_ids: vec![],
                    dns_name: None,
                    device_id: Some(*spine_device_id),
                    interface_name: Some(spine_if_name.clone()),
                    vrf_id: None,
                };
                if let Err(e) = state.store.create_ipam_ip_address(&spine_ip_req).await {
                    tracing::warn!("Failed to reserve uplink IP {} for {}: {}", spine_ip, spine.hostname, e);
                }

                // Spine uplink peer vars (from resolved uplink port name)
                let spine_uplink_peer_idx: usize = spine_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(spine_leaf_port_count + spine_uplink_idx + 1);
                spine_vars[si].push((spine_uplink_peer_idx, ext_ip.clone(), ext.asn.to_string(), ext.hostname.clone(), spine_ip.clone()));

                // External peer vars: extract port number from resolved port name
                let ext_peer_idx: usize = ext_if_name.trim_start_matches(|c: char| !c.is_ascii_digit())
                    .parse().unwrap_or(ext_port_idx + 1);
                external_vars[ei].push((ext_peer_idx, spine_ip.clone(), spine.asn.to_string(), spine.hostname.clone(), ext_ip.clone()));

                fabric_links.push(format!(
                    "{} ({}) <-> {} ({}) [{}]",
                    ext.hostname, ext_ip, spine.hostname, spine_ip, subnet.prefix
                ));
            }
        }
    }

    // Set variables for spines
    for (si, (device_id, node)) in spines.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &spine_vars[si] {
            entries.push((*device_id, format!("Peer{}", idx), peer_ip.clone()));
            entries.push((*device_id, format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((*device_id, format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((*device_id, format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Set variables for leaves
    for (li, (device_id, node)) in leaves.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &leaf_vars[li] {
            entries.push((*device_id, format!("Peer{}", idx), peer_ip.clone()));
            entries.push((*device_id, format!("Peer{}ASN", idx), peer_asn.clone()));
            entries.push((*device_id, format!("Peer{}Name", idx), peer_name.clone()));
            entries.push((*device_id, format!("Peer{}Addr", idx), local_addr.clone()));
        }
        if let Err(e) = state.store.bulk_set_device_variables(&entries).await {
            tracing::warn!("Failed to set variables for {}: {}", node.hostname, e);
        }
    }

    // Set variables for external devices
    for (ei, (device_id, node)) in externals.iter().enumerate() {
        let mut entries = vec![
            (*device_id, "Loopback".to_string(), node.loopback.clone()),
            (*device_id, "ASN".to_string(), node.asn.to_string()),
        ];
        for (idx, peer_ip, peer_asn, peer_name, local_addr) in &external_vars[ei] {
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
    // Each spine↔leaf link creates a port assignment on both sides, routed through the leaf row's patch panel
    let mut pp_port_counters: HashMap<i64, usize> = HashMap::new();
    for (si, (spine_device_id, spine)) in spines.iter().enumerate() {
        for (li, (leaf_device_id, leaf)) in leaves.iter().enumerate() {
            // Find the patch panel for the leaf's row
            let leaf_pp_id = leaf.row_id.and_then(|rid| patch_panels.get(&rid)).copied();
            for link in 0..links_per_leaf as u32 {
                let spine_if = format!("Ethernet{}", li * links_per_leaf + link as usize + 1);
                let leaf_port_idx = si * links_per_leaf + link as usize;
                let leaf_100g = model_100g_ports.get(&leaf.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let leaf_if = leaf_100g.get(leaf_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", leaf_port_idx + 1));
                // Allocate patch panel ports in pairs: Port N (spine side), Port N+1 (leaf side)
                let (pp_a_id, pp_a_port, pp_b_id, pp_b_port) = if let Some(pp_id) = leaf_pp_id {
                    let port_num = pp_port_counters.entry(pp_id).or_insert(0);
                    let a_port_num = *port_num + 1;
                    let b_port_num = *port_num + 2;
                    *port_num += 2;
                    (Some(pp_id), Some(format!("Port {}", a_port_num)), Some(pp_id), Some(format!("Port {}", b_port_num)))
                } else {
                    (None, None, None, None)
                };
                // Spine-side port assignment
                let spine_pa = crate::models::SetPortAssignmentRequest {
                    port_name: spine_if.clone(),
                    remote_device_id: Some(*leaf_device_id),
                    remote_port_name: leaf_if.clone(),
                    description: Some(format!("{} <-> {} link {}", spine.hostname, leaf.hostname, link + 1)),
                    patch_panel_a_id: pp_a_id,
                    patch_panel_a_port: pp_a_port.clone(),
                    patch_panel_b_id: pp_b_id,
                    patch_panel_b_port: pp_b_port.clone(),
                    vrf_id: None,
                };
                if let Err(e) = state.store.set_port_assignment(*spine_device_id, &spine_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", spine_if, spine.hostname, e);
                }
                // Leaf-side port assignment (reverse direction, swap A/B patch panel ports)
                let leaf_pa = crate::models::SetPortAssignmentRequest {
                    port_name: leaf_if,
                    remote_device_id: Some(*spine_device_id),
                    remote_port_name: spine_if,
                    description: Some(format!("{} <-> {} link {}", leaf.hostname, spine.hostname, link + 1)),
                    patch_panel_a_id: pp_b_id,
                    patch_panel_a_port: pp_b_port,
                    patch_panel_b_id: pp_a_id,
                    patch_panel_b_port: pp_a_port,
                    vrf_id: None,
                };
                if let Err(e) = state.store.set_port_assignment(*leaf_device_id, &leaf_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", leaf_pa.port_name, leaf.hostname, e);
                }
            }
        }
    }

    // External↔spine port assignments (no patch panel — externals are in spine rack)
    for (ei, (ext_device_id, ext)) in externals.iter().enumerate() {
        for (si, (spine_device_id, spine)) in spines.iter().enumerate() {
            for link in 0..uplinks_per_spine {
                let ext_port_idx = si * uplinks_per_spine + link;
                let ext_100g = model_100g_ports.get(&ext.model).map(|p| p.as_slice()).unwrap_or(&[]);
                let ext_if = ext_100g.get(ext_port_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", ext_port_idx + 1));
                let spine_uplink_idx = ei * uplinks_per_spine + link;
                let spine_if = spine_uplink_ports.get(spine_uplink_idx).cloned()
                    .unwrap_or_else(|| format!("Ethernet{}", spine_leaf_port_count + spine_uplink_idx + 1));
                // External-side
                let ext_pa = crate::models::SetPortAssignmentRequest {
                    port_name: ext_if.clone(),
                    remote_device_id: Some(*spine_device_id),
                    remote_port_name: spine_if.clone(),
                    description: Some(format!("{} <-> {} uplink {}", ext.hostname, spine.hostname, link + 1)),
                    patch_panel_a_id: None,
                    patch_panel_a_port: None,
                    patch_panel_b_id: None,
                    patch_panel_b_port: None,
                    vrf_id: None,
                };
                if let Err(e) = state.store.set_port_assignment(*ext_device_id, &ext_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", ext_if, ext.hostname, e);
                }
                // Spine-side (uplink)
                let spine_pa = crate::models::SetPortAssignmentRequest {
                    port_name: spine_if.clone(),
                    remote_device_id: Some(*ext_device_id),
                    remote_port_name: ext_if,
                    description: Some(format!("{} <-> {} uplink {}", spine.hostname, ext.hostname, link + 1)),
                    patch_panel_a_id: None,
                    patch_panel_a_port: None,
                    patch_panel_b_id: None,
                    patch_panel_b_port: None,
                    vrf_id: None,
                };
                if let Err(e) = state.store.set_port_assignment(*spine_device_id, &spine_pa).await {
                    tracing::warn!("Failed to create port assignment {} on {}: {}", spine_if, spine.hostname, e);
                }
            }
        }
    }

    tracing::info!("Created port assignments for {} patch panels", patch_panels.len());

    // Generate configs
    if let Err(e) = state.config_manager.generate_config().await {
        tracing::warn!("Failed to generate config after virtual CLOS build: {}", e);
    }

    // Optionally spawn cEOS or FRR containers for each device
    if spawn_containers {
        match bollard::Docker::connect_with_socket_defaults() {
            Ok(docker) => {
                let network_name = get_network_name();

                for (device_id, node) in &created_ids {
                    let container_name = format!("vclos-{}", node.hostname);
                    let mac = result_devices.iter().find(|d| d.hostname == node.hostname)
                        .map(|d| d.mac.clone()).unwrap_or_default();
                    let serial = format!("SN-VCLOS-{}", node.hostname);

                    let mut labels = HashMap::new();
                    labels.insert("fc-test-client".to_string(), "true".to_string());
                    labels.insert("fc-vclos".to_string(), VIRTUAL_CLOS_TOPOLOGY_ID.to_string());

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
                        // cEOS container config
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
                                            config_template: role_templates.get(&node.role).cloned().unwrap_or_default(),
                                            ssh_user: Some("admin".to_string()),
                                            ssh_pass: Some("admin".to_string()),
                                            topology_id: Some(topo_id_str.clone()),
                                            topology_role: Some(node.role.clone()),
                                            device_type: node.device_type.clone(),
                                            hall_id: node.hall_id.clone(),
                                            row_id: node.row_id.clone(),
                                            rack_id: node.rack_id.clone(),
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
                let spine_containers: Vec<(String, String)> = created_ids.iter()
                    .filter(|(_, n)| n.role == "spine")
                    .map(|(_, n)| (format!("vclos-{}", n.hostname), n.hostname.clone()))
                    .collect();
                let leaf_containers: Vec<(String, String)> = created_ids.iter()
                    .filter(|(_, n)| n.role == "leaf")
                    .map(|(_, n)| (format!("vclos-{}", n.hostname), n.hostname.clone()))
                    .collect();

                // Create spine↔leaf fabric links (links_per_leaf links per pair)
                for (_si, (spine_cname, spine_host)) in spine_containers.iter().enumerate() {
                    for (_li, (leaf_cname, leaf_host)) in leaf_containers.iter().enumerate() {
                        for link in 0..links_per_leaf as u32 {
                            let net_name = format!("vclos-{}-{}-link{}", spine_host, leaf_host, link + 1);
                            let create_opts = bollard::network::CreateNetworkOptions {
                                name: net_name.clone(),
                                driver: "bridge".to_string(),
                                labels: {
                                    let mut l = HashMap::new();
                                    l.insert("fc-vclos".to_string(), VIRTUAL_CLOS_TOPOLOGY_ID.to_string());
                                    l
                                },
                                ..Default::default()
                            };
                            if let Err(e) = docker.create_network(create_opts).await {
                                tracing::warn!("Failed to create fabric network {}: {}", net_name, e);
                                continue;
                            }
                            // Connect spine then leaf
                            let spine_connect = bollard::network::ConnectNetworkOptions {
                                container: spine_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, spine_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", spine_cname, net_name, e);
                            }
                            let leaf_connect = bollard::network::ConnectNetworkOptions {
                                container: leaf_cname.clone(),
                                ..Default::default()
                            };
                            if let Err(e) = docker.connect_network(&net_name, leaf_connect).await {
                                tracing::warn!("Failed to connect {} to {}: {}", leaf_cname, net_name, e);
                            }
                        }
                    }
                }

                // Create one external network per spine for uplink connectivity
                for (_si, (spine_cname, spine_host)) in spine_containers.iter().enumerate() {
                    let net_name = format!("vclos-{}-external", spine_host);
                    let create_opts = bollard::network::CreateNetworkOptions {
                        name: net_name.clone(),
                        driver: "bridge".to_string(),
                        labels: {
                            let mut l = HashMap::new();
                            l.insert("fc-vclos".to_string(), VIRTUAL_CLOS_TOPOLOGY_ID.to_string());
                            l
                        },
                        ..Default::default()
                    };
                    if let Err(e) = docker.create_network(create_opts).await {
                        tracing::warn!("Failed to create external network {}: {}", net_name, e);
                        continue;
                    }
                    let connect = bollard::network::ConnectNetworkOptions {
                        container: spine_cname.clone(),
                        ..Default::default()
                    };
                    if let Err(e) = docker.connect_network(&net_name, connect).await {
                        tracing::warn!("Failed to connect {} to {}: {}", spine_cname, net_name, e);
                    }
                }

                // For FRR: configure BGP via docker exec after containers and networks are ready
                if use_frr {
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    configure_frr_bgp_nodes(&docker, &created_ids, &spine_vars, &leaf_vars, &external_vars).await;
                }
            }
            Err(e) => {
                tracing::warn!("Docker not available for container spawning: {}", e);
            }
        }
    }

    Ok(Json(ClosLabResponse {
        topology_id: topo_id_str,
        topology_name: VIRTUAL_CLOS_TOPOLOGY_NAME.to_string(),
        devices: result_devices,
        fabric_links,
    }))
}

/// Configure BGP on FRR containers via docker exec (vtysh)
async fn configure_frr_bgp_nodes(
    docker: &bollard::Docker,
    created_ids: &[(i64, VNode)],
    spine_vars: &[Vec<(usize, String, String, String, String)>],
    leaf_vars: &[Vec<(usize, String, String, String, String)>],
    external_vars: &[Vec<(usize, String, String, String, String)>],
) {
    let spines: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "spine").collect();
    let leaves: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "leaf").collect();
    let externals: Vec<_> = created_ids.iter().filter(|(_, n)| n.role == "external").collect();

    // Helper: configure one FRR node
    async fn configure_one(docker: &bollard::Docker, hostname: &str, loopback: &str, asn: u32, peers: &[(usize, String, String, String, String)]) {
        let container_name = format!("vclos-{}", hostname);
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

    for (si, (_, node)) in spines.iter().enumerate() {
        if let Some(vars) = spine_vars.get(si) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
    for (li, (_, node)) in leaves.iter().enumerate() {
        if let Some(vars) = leaf_vars.get(li) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
    for (ei, (_, node)) in externals.iter().enumerate() {
        if let Some(vars) = external_vars.get(ei) {
            configure_one(docker, &node.hostname, &node.loopback, node.asn, vars).await;
        }
    }
}

/// Teardown virtual CLOS topology
pub async fn teardown_virtual_clos(
    _auth: crate::auth::AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, ApiError> {
    teardown_virtual_clos_inner(&state).await;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn teardown_virtual_clos_inner(state: &Arc<AppState>) {
    // Remove any spawned cEOS containers (labeled fc-vclos)
    if let Ok(docker) = bollard::Docker::connect_with_socket_defaults() {
        let mut filters = HashMap::new();
        filters.insert("label".to_string(), vec![format!("fc-vclos={}", VIRTUAL_CLOS_TOPOLOGY_ID)]);
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
                    tracing::info!("Removed vclos container {}", id);
                }
            }
        }
        // Clean up fabric networks (labeled fc-vclos)
        let mut net_filters = HashMap::new();
        net_filters.insert("label".to_string(), vec![format!("fc-vclos={}", VIRTUAL_CLOS_TOPOLOGY_ID)]);
        let net_opts = bollard::network::ListNetworksOptions { filters: net_filters };
        if let Ok(networks) = docker.list_networks(Some(net_opts)).await {
            for net in &networks {
                if let Some(id) = &net.id {
                    let _ = docker.remove_network(id).await;
                    tracing::info!("Removed vclos network {}", net.name.as_deref().unwrap_or(id));
                }
            }
        }
    }

    // Find the topology by name to get its numeric ID for device cleanup
    let topos = state.store.list_topologies().await.unwrap_or_default();
    let vclos_topo = topos.iter().find(|t| t.name == VIRTUAL_CLOS_TOPOLOGY_NAME);
    if let Some(topo) = vclos_topo {
        let topo_id_str = topo.id.to_string();
        let deleted = state.store.delete_devices_by_topology(&topo_id_str).await.unwrap_or(0);
        if deleted > 0 {
            tracing::info!("Deleted {} virtual CLOS devices", deleted);
        }
    }

    // Clean up IPAM: delete /31 prefixes under the P2P pool and loopback pool
    // Also delete IP addresses (cascade from prefix deletion)
    if let Ok(Some(p2p_pool)) = state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_P2P_CIDR, None).await {
        // Delete all child /31 prefixes under the P2P pool
        if let Ok(all_prefixes) = state.store.list_ipam_prefixes().await {
            for prefix in all_prefixes.iter().filter(|p| p.parent_id == Some(p2p_pool.id)) {
                let _ = state.store.delete_ipam_prefix(prefix.id).await;
            }
        }
        // Delete the P2P pool itself
        let _ = state.store.delete_ipam_prefix(p2p_pool.id).await;
    }
    if let Ok(Some(lo_pool)) = state.store.find_ipam_prefix_by_cidr(VIRTUAL_CLOS_LOOPBACK_CIDR, None).await {
        // Delete IP addresses under loopback pool (they won't cascade from prefix deletion since they're direct children)
        if let Ok(ips) = state.store.list_ipam_ip_addresses_by_prefix(lo_pool.id).await {
            for ip in &ips {
                let _ = state.store.delete_ipam_ip_address(ip.id).await;
            }
        }
        // Delete the loopback pool itself
        let _ = state.store.delete_ipam_prefix(lo_pool.id).await;
    }

    let _ = state.store.delete_topology_by_name(VIRTUAL_CLOS_TOPOLOGY_NAME).await;

    // Clean up auto-created org entities (matched by description)
    // Delete in reverse order: racks, rows, halls
    let vclos_desc = "Auto-created by Virtual CLOS";
    if let Ok(racks) = state.store.list_ipam_racks().await {
        for rack in racks.iter().filter(|r| r.description.as_deref().map_or(false, |d| d.starts_with(vclos_desc))) {
            let _ = state.store.delete_ipam_rack(rack.id).await;
        }
    }
    if let Ok(rows) = state.store.list_ipam_rows().await {
        for row in rows.iter().filter(|r| r.description.as_deref().map_or(false, |d| d.starts_with(vclos_desc))) {
            let _ = state.store.delete_ipam_row(row.id).await;
        }
    }
    if let Ok(halls) = state.store.list_ipam_halls().await {
        for hall in halls.iter().filter(|h| h.description.as_deref().map_or(false, |d| d.starts_with(vclos_desc))) {
            let _ = state.store.delete_ipam_hall(hall.id).await;
        }
    }
}
