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
    pub topology_id: String,
    #[serde(default)]
    pub topology_role: String,
}

#[derive(Deserialize)]
pub struct ClosLabRequest {
    #[serde(default)]
    pub image: String,
}

#[derive(Deserialize)]
pub struct VirtualClosRequest {
    #[serde(default = "default_spine_count")]
    pub spines: usize,
    #[serde(default = "default_leaf_count")]
    pub leaves: usize,
    #[serde(default)]
    pub region_id: Option<String>,
    #[serde(default)]
    pub campus_id: Option<String>,
    #[serde(default)]
    pub datacenter_id: Option<String>,
    #[serde(default = "default_hall_count")]
    pub halls: usize,
    #[serde(default = "default_rows_per_hall")]
    pub rows_per_hall: usize,
    #[serde(default = "default_racks_per_row")]
    pub racks_per_row: usize,
    #[serde(default = "default_leaves_per_rack")]
    pub leaves_per_rack: usize,
    #[serde(default = "default_external_devices")]
    pub external_devices: usize,
    #[serde(default = "default_uplinks_per_spine")]
    pub uplinks_per_spine: usize,
    /// Custom hostnames for external devices (one per external device)
    #[serde(default)]
    pub external_names: Vec<String>,
    /// When true, also spawn cEOS Docker containers for each device
    #[serde(default)]
    pub spawn_containers: bool,
    /// cEOS image to use when spawning containers (default: ceosimage:latest)
    #[serde(default)]
    pub ceos_image: String,
}
fn default_spine_count() -> usize { 2 }
fn default_leaf_count() -> usize { 16 }
fn default_hall_count() -> usize { 1 }
fn default_rows_per_hall() -> usize { 1 }
fn default_racks_per_row() -> usize { 2 }
fn default_leaves_per_rack() -> usize { 2 }
fn default_uplinks_per_spine() -> usize { 2 }
fn default_external_devices() -> usize { 2 }

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

pub(super) fn get_network_name() -> String {
    std::env::var("DOCKER_NETWORK").unwrap_or_else(|_| "ztp-server_ztp-net".to_string())
}

pub(super) fn get_image_name() -> String {
    std::env::var("TEST_CLIENT_IMAGE").unwrap_or_else(|_| "ztp-server-test-client".to_string())
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
