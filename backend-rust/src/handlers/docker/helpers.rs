use serde::{Deserialize, Serialize};

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
    pub topology_id: i64,
    #[serde(default)]
    pub topology_role: String,
}

/// Unified topology builder request — works for both CLOS and Hierarchical architectures.
/// Generic tier fields are mapped to role names based on `architecture`.
#[derive(Deserialize)]
pub struct UnifiedTopologyRequest {
    /// Architecture type: "clos" or "hierarchical"
    #[serde(default = "default_architecture")]
    pub architecture: String,

    // External tier (CLOS only)
    #[serde(default = "default_external_count")]
    pub external_count: usize,
    #[serde(default = "default_ratio")]
    pub external_to_tier1_ratio: usize,

    // Tier 1 (spine for CLOS, core for hierarchical)
    #[serde(default = "default_tier1_count")]
    pub tier1_count: usize,
    #[serde(default = "default_ratio")]
    pub tier1_to_tier2_ratio: usize,
    #[serde(default)]
    pub tier1_model: String,
    #[serde(default)]
    pub tier1_names: Vec<String>,

    // Tier 2 (leaf for CLOS, distribution for hierarchical)
    #[serde(default = "default_tier2_count")]
    pub tier2_count: usize,
    #[serde(default = "default_ratio")]
    pub tier2_to_tier3_ratio: usize,
    #[serde(default)]
    pub tier2_model: String,

    // Tier 3 (N/A for CLOS, access for hierarchical)
    #[serde(default)]
    pub tier3_count: usize,
    #[serde(default)]
    pub tier3_model: String,

    // Location + rack layout
    #[serde(default)]
    pub region_id: Option<i64>,
    #[serde(default)]
    pub campus_id: Option<i64>,
    #[serde(default)]
    pub datacenter_id: Option<i64>,
    #[serde(default = "default_hall_count")]
    pub halls: usize,
    #[serde(default = "default_rows_per_hall")]
    pub rows_per_hall: usize,
    #[serde(default = "default_racks_per_row")]
    pub racks_per_row: usize,
    #[serde(default = "default_devices_per_rack")]
    pub devices_per_rack: usize,

    // Container spawning
    #[serde(default)]
    pub spawn_containers: bool,
    #[serde(default)]
    pub ceos_image: String,

    // Rack placement strategy for the lowest-tier devices
    #[serde(default)]
    pub tier3_placement: String,  // "top", "middle", "bottom"; default "bottom"

    // Super-spine tier (5-stage CLOS extension)
    #[serde(default)]
    pub super_spine_enabled: bool,
    #[serde(default)]
    pub super_spine_count: usize,
    #[serde(default)]
    pub super_spine_model: String,
    #[serde(default = "default_ratio")]
    pub spine_to_super_spine_ratio: usize,
    #[serde(default = "default_one")]
    pub pods: usize,

    // Physical spacing for cable length estimation
    #[serde(default = "default_row_spacing")]
    pub row_spacing_cm: usize,

    // User-provided topology name (falls back to architecture default if empty)
    #[serde(default)]
    pub topology_name: String,

    // GPU cluster configuration
    #[serde(default)]
    pub gpu_cluster_count: usize,
    #[serde(default = "default_gpu_model")]
    pub gpu_model: String,
    #[serde(default = "default_gpus_per_node")]
    pub gpus_per_node: usize,
    #[serde(default = "default_gpu_nodes_per_cluster")]
    pub gpu_nodes_per_cluster: usize,
    #[serde(default = "default_interconnect")]
    pub gpu_interconnect: String,

    // Per-cluster VRF assignment (indexed by cluster position)
    #[serde(default)]
    pub gpu_vrf_ids: Vec<i64>,

    // GPU cabling options
    #[serde(default = "default_true")]
    pub gpu_include_leaf_uplinks: bool,
    #[serde(default = "default_true")]
    pub gpu_include_fabric_cabling: bool,

    // Management switch configuration
    #[serde(default)]
    pub mgmt_switch_model: String,
    /// Distribution: "per-row" (default), "per-rack", "per-hall", or "count-per-row"
    #[serde(default = "default_mgmt_distribution")]
    pub mgmt_switch_distribution: String,
    /// Count of mgmt switches per row (only used when distribution = "count-per-row")
    #[serde(default = "default_one")]
    pub mgmt_switches_per_row: usize,
}

fn default_mgmt_distribution() -> String { "per-row".to_string() }
fn default_true() -> bool { true }

fn default_gpu_model() -> String { "MI300X".to_string() }
fn default_gpus_per_node() -> usize { 8 }
fn default_gpu_nodes_per_cluster() -> usize { 8 }
fn default_interconnect() -> String { "InfiniBand".to_string() }
fn default_architecture() -> String { "clos".to_string() }
fn default_external_count() -> usize { 2 }
fn default_ratio() -> usize { 2 }
fn default_tier1_count() -> usize { 2 }
fn default_tier2_count() -> usize { 16 }
fn default_hall_count() -> usize { 1 }
fn default_rows_per_hall() -> usize { 1 }
fn default_racks_per_row() -> usize { 2 }
fn default_devices_per_rack() -> usize { 2 }
fn default_one() -> usize { 1 }
fn default_row_spacing() -> usize { 120 } // 120cm (~4 feet) between rows

/// Response from the topology builder endpoint
#[derive(Serialize)]
pub struct TopologyBuildResponse {
    pub topology_id: i64,
    pub topology_name: String,
    pub devices: Vec<TopologyBuildDevice>,
    pub fabric_links: Vec<String>,
}

#[derive(Serialize)]
pub struct TopologyBuildDevice {
    pub hostname: String,
    pub role: String,
    pub mac: String,
    pub ip: String,
    pub container_name: String,
}

pub(super) fn get_network_name() -> String {
    std::env::var("DOCKER_NETWORK").unwrap_or_else(|_| "forge-config_fc-net".to_string())
}

pub(super) fn get_image_name() -> String {
    std::env::var("TEST_CLIENT_IMAGE").unwrap_or_else(|_| "forge-config-test-client".to_string())
}

/// Generate a random MAC address with the locally administered bit set
pub(super) fn generate_mac() -> String {
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
pub fn is_ceos_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("ceos") || lower.contains("ceosimage")
}

/// Check if this is an FRR image
pub fn is_frr_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("frr")
}

/// Check if this is a GoBGP image
pub(super) fn is_gobgp_image(image: &str) -> bool {
    let lower = image.to_lowercase();
    lower.contains("gobgp")
}

/// Extract port names from a device model layout JSON, filtered by minimum speed (in Mbps).
/// Returns port names sorted by their Ethernet number (e.g. Ethernet49, Ethernet50, ...).
pub fn get_ports_by_min_speed(layout_json: &str, min_speed: u64) -> Vec<String> {
    let layout: Vec<serde_json::Value> = match serde_json::from_str(layout_json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let mut ports: Vec<(u32, String)> = Vec::new();
    for row in &layout {
        if let Some(sections) = row.get("sections").and_then(|s| s.as_array()) {
            for section in sections {
                if let Some(port_list) = section.get("ports").and_then(|p| p.as_array()) {
                    for port in port_list {
                        let speed = port.get("speed").and_then(|s| s.as_u64()).unwrap_or(0);
                        let name = port.get("vendor_port_name").and_then(|n| n.as_str()).unwrap_or("");
                        let role = port.get("role").and_then(|r| r.as_str()).unwrap_or("");
                        if speed >= min_speed && role != "mgmt" && !name.is_empty() {
                            // Extract numeric suffix for sorting (e.g. "Ethernet49" -> 49)
                            let num: u32 = name.trim_start_matches(|c: char| !c.is_ascii_digit())
                                .parse()
                                .unwrap_or(0);
                            ports.push((num, name.to_string()));
                        }
                    }
                }
            }
        }
    }
    ports.sort_by_key(|(num, _)| *num);
    ports.into_iter().map(|(_, name)| name).collect()
}

/// Generate a MAC with Arista OUI (00:1C:73) + random lower 3 bytes
pub(super) fn generate_arista_mac() -> String {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let b3: u8 = rng.gen();
    let b4: u8 = rng.gen();
    let b5: u8 = rng.gen();
    format!("00:1c:73:{:02x}:{:02x}:{:02x}", b3, b4, b5)
}

/// cEOS startup-config that mimics a real Arista switch out of the box.
/// Placeholders: {hostname}, {serial_number}
pub(super) const CEOS_STARTUP_CONFIG: &str = r#"! device: {hostname}
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

/// Compute rack position based on placement strategy.
/// - Bottom: positions 1, 2, 3, ... (traditional default)
/// - Top: positions 42, 41, 40, ... (counting down from rack height)
/// - Middle: positions centered around midpoint
pub fn compute_rack_position(device_index_in_rack: usize, placement: &str, rack_height: i32) -> i32 {
    match placement {
        "top" => rack_height - device_index_in_rack as i32,
        "middle" => (rack_height / 2) + device_index_in_rack as i32,
        _ => device_index_in_rack as i32 + 1, // "bottom" = default
    }
}

/// Estimate cable length in meters between two devices based on rack positions.
/// Accounts for horizontal distance between racks, row spacing, and vertical
/// distance within racks (distance from cable tray at top of rack).
/// Returns None if either device has no rack assignment.
///
/// All internal math in centimeters for precision, output rounded to 1 decimal meter.
pub fn estimate_cable_length(
    rack_a_index: Option<usize>,
    rack_a_position: Option<i32>,
    rack_b_index: Option<usize>,
    rack_b_position: Option<i32>,
    racks_per_row: usize,
    row_spacing_cm: usize,
    slack_percent: i32,
) -> Option<f64> {
    let ra = rack_a_index?;
    let rb = rack_b_index?;
    let pos_a = rack_a_position.unwrap_or(1);
    let pos_b = rack_b_position.unwrap_or(1);

    // Constants (in cm)
    const RACK_SLOT_CM: usize = 76; // 60cm rack + 8cm post clearance each side
    const U_HEIGHT_CM: f64 = 4.445; // 1U = 4.445cm (1.75")
    const RACK_HEIGHT_U: i32 = 42;

    // Total racks per row including the spine rack at midpoint
    let total_slots_per_row = racks_per_row + 1; // leaf racks + 1 spine rack

    // Determine which row each rack is in
    let row_a = ra / total_slots_per_row;
    let row_b = rb / total_slots_per_row;
    let pos_in_row_a = ra % total_slots_per_row;
    let pos_in_row_b = rb % total_slots_per_row;

    // Horizontal distance (cm)
    let horizontal_cm = if row_a == row_b {
        // Same row: count rack slots between them
        let diff = if pos_in_row_a > pos_in_row_b {
            pos_in_row_a - pos_in_row_b
        } else {
            pos_in_row_b - pos_in_row_a
        };
        (diff * RACK_SLOT_CM) as f64
    } else {
        // Different rows: distance within each row to aisle + row spacing
        let row_diff = if row_a > row_b { row_a - row_b } else { row_b - row_a };
        let dist_a = (pos_in_row_a * RACK_SLOT_CM) as f64;
        let dist_b = (pos_in_row_b * RACK_SLOT_CM) as f64;
        dist_a + dist_b + (row_diff * row_spacing_cm) as f64
    };

    // Vertical distance (cm): both devices' distance from cable tray (top of rack = U42)
    let vert_a = (RACK_HEIGHT_U - pos_a) as f64 * U_HEIGHT_CM;
    let vert_b = (RACK_HEIGHT_U - pos_b) as f64 * U_HEIGHT_CM;
    let vertical_cm = if ra == rb {
        // Same rack: just the difference between positions
        (pos_a - pos_b).unsigned_abs() as f64 * U_HEIGHT_CM
    } else {
        // Different racks: both go up to tray
        vert_a + vert_b
    };

    // Add slack for service loops, convert to meters
    let raw_cm = horizontal_cm + vertical_cm;
    let with_slack_cm = raw_cm * (1.0 + slack_percent as f64 / 100.0);
    let meters = with_slack_cm / 100.0;
    // Round to 1 decimal place
    Some((meters * 10.0).round() / 10.0)
}

// ─────────────────────────────────────────────────────────────────────────────
// Topology Preview types — read-only computation of what a build will produce
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct TopologyPreviewDevice {
    pub index: usize,
    pub hostname: String,
    pub role: String,
    pub loopback: String,
    pub asn: u32,
    pub model: String,
    pub mgmt_ip: String,
    pub rack_name: Option<String>,
    pub rack_index: Option<usize>,
    pub rack_position: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_type: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TopologyPreviewLink {
    pub side_a_hostname: String,
    pub side_a_interface: String,
    pub side_a_ip: String,
    pub side_b_hostname: String,
    pub side_b_interface: String,
    pub side_b_ip: String,
    pub subnet: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cable_length_meters: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TopologyPreviewRack {
    pub index: usize,
    pub name: String,
    pub hall_name: String,
    pub row_name: String,
    pub rack_type: String,
}

#[derive(Serialize, Clone)]
pub struct TopologyPreviewGpuCluster {
    pub name: String,
    pub gpu_model: String,
    pub node_count: usize,
    pub gpus_per_node: usize,
    pub interconnect: String,
    /// Leaf hostnames this cluster's nodes are striped across
    pub leaf_assignments: Vec<String>,
    /// Indices into the main devices array for this cluster's GPU nodes
    #[serde(default)]
    pub device_indices: Vec<usize>,
    /// Leaf uplink links (GPU node Ethernet → Leaf port)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub leaf_uplink_links: Vec<TopologyPreviewLink>,
    /// GPU fabric links (IB mesh within the cluster)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fabric_links: Vec<TopologyPreviewLink>,
}

#[derive(Serialize)]
pub struct TopologyPreviewResponse {
    pub architecture: String,
    pub topology_name: String,
    pub devices: Vec<TopologyPreviewDevice>,
    pub fabric_links: Vec<TopologyPreviewLink>,
    pub racks: Vec<TopologyPreviewRack>,
    pub tier3_placement: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub gpu_clusters: Vec<TopologyPreviewGpuCluster>,
}

/// Request to build a topology with optional user overrides from preview
#[derive(Deserialize)]
pub struct TopologyBuildWithOverrides {
    #[serde(flatten)]
    pub config: UnifiedTopologyRequest,
    #[serde(default)]
    pub overrides: Option<TopologyOverrides>,
}

#[derive(Deserialize)]
pub struct TopologyOverrides {
    pub devices: Vec<TopologyPreviewDevice>,
    #[serde(default)]
    pub racks: Option<Vec<TopologyPreviewRack>>,
}

/// Build a tar archive in memory containing files
pub(super) fn build_tar(files: &[(&str, &[u8], u32)]) -> Result<Vec<u8>, String> {
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
