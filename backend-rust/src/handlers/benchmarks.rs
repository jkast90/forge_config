use axum::Json;

/// Static benchmark handler - no DB operations
pub async fn benchmark_handler(_auth: crate::auth::AuthUser) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "message": "benchmark response",
        "data": {
            "id": 1,
            "name": "test",
            "value": 42
        }
    }))
}

/// Calculate Mandelbrot set and return total iteration count
fn calculate_mandelbrot(width: u32, height: u32, max_iter: u32) -> i64 {
    let mut total_iterations: i64 = 0;

    for py in 0..height {
        for px in 0..width {
            let x0 = (px as f64) / (width as f64) * 3.5 - 2.5;
            let y0 = (py as f64) / (height as f64) * 2.0 - 1.0;

            let mut x = 0.0;
            let mut y = 0.0;
            let mut iteration = 0u32;

            while x * x + y * y <= 4.0 && iteration < max_iter {
                let xtemp = x * x - y * y + x0;
                y = 2.0 * x * y + y0;
                x = xtemp;
                iteration += 1;
            }
            total_iterations += iteration as i64;
        }
    }
    total_iterations
}

/// Mandelbrot benchmark handler - CPU intensive
pub async fn mandelbrot_handler(_auth: crate::auth::AuthUser) -> Json<serde_json::Value> {
    let start = std::time::Instant::now();
    let iterations = calculate_mandelbrot(800, 800, 1000);
    let elapsed = start.elapsed();

    Json(serde_json::json!({
        "status": "ok",
        "width": 800,
        "height": 800,
        "max_iter": 1000,
        "iterations": iterations,
        "elapsed_ms": elapsed.as_secs_f64() * 1000.0
    }))
}

/// Typed structs for faster JSON serialization
#[derive(serde::Serialize)]
pub(crate) struct BenchmarkItem {
    id: i32,
    name: String,
    description: &'static str,
    active: bool,
    score: f64,
    tags: Vec<String>,
    metadata: BenchmarkMetadata,
}

#[derive(serde::Serialize)]
struct BenchmarkMetadata {
    created_at: &'static str,
    updated_at: &'static str,
    version: i32,
    priority: i32,
}

#[derive(serde::Serialize)]
pub(crate) struct JsonBenchResponse {
    status: &'static str,
    elapsed_ms: f64,
    items: usize,
    data: Vec<BenchmarkItem>,
}

/// Generate large nested structure for JSON serialization benchmarking
fn generate_large_json() -> Vec<BenchmarkItem> {
    (0..1000)
        .map(|i| BenchmarkItem {
            id: i,
            name: format!("Item {}", i),
            description: "This is a test item for JSON serialization benchmarking",
            active: i % 2 == 0,
            score: i as f64 * 1.5,
            tags: vec![
                "benchmark".to_string(),
                "test".to_string(),
                "json".to_string(),
                format!("tag{}", i % 10),
            ],
            metadata: BenchmarkMetadata {
                created_at: "2024-01-15T10:30:00Z",
                updated_at: "2024-01-15T12:45:00Z",
                version: i % 5,
                priority: (i % 3) + 1,
            },
        })
        .collect()
}

/// JSON serialization benchmark handler
pub async fn json_bench_handler(_auth: crate::auth::AuthUser) -> Json<JsonBenchResponse> {
    let start = std::time::Instant::now();
    let data = generate_large_json();
    let elapsed = start.elapsed();

    Json(JsonBenchResponse {
        status: "ok",
        elapsed_ms: elapsed.as_secs_f64() * 1000.0,
        items: data.len(),
        data,
    })
}

/// Large enterprise switch configuration template for benchmarking
const LARGE_CONFIG_TEMPLATE: &str = r#"!
! ============================================================
! Enterprise Switch Configuration
! Hostname: {{Hostname}}
! Generated: {{Timestamp}}
! MAC Address: {{MAC}}
! Serial: {{SerialNumber}}
! ============================================================
!
version 15.2
service timestamps debug datetime msec localtime show-timezone
service timestamps log datetime msec localtime show-timezone
service password-encryption
service compress-config
!
hostname {{Hostname}}
!
boot-start-marker
boot-end-marker
!
logging buffered 65536 informational
logging console critical
enable secret 5 $1$xyz$HashedPasswordHere
!
username {{AdminUser}} privilege 15 secret {{AdminPassword}}
username operator privilege 5 secret {{OperatorPassword}}
username readonly privilege 1 secret {{ReadonlyPassword}}
!
aaa new-model
aaa authentication login default local
aaa authorization exec default local
aaa accounting exec default start-stop group tacacs+
!
clock timezone {{Timezone}} {{TimezoneOffset}}
clock summer-time EDT recurring
!
ip domain-name {{DomainName}}
ip name-server {{DNS1}}
ip name-server {{DNS2}}
!
ip ssh version 2
ip ssh time-out 60
ip ssh authentication-retries 3
crypto key generate rsa modulus 2048
!
{% for vlan in VLANs %}!
vlan {{vlan.id}}
 name {{vlan.name}}
{% endfor %}!
spanning-tree mode rapid-pvst
spanning-tree extend system-id
spanning-tree vlan 1-4094 priority {{STPPriority}}
!
{% for iface in Interfaces %}!
interface {{iface.name}}
 description {{iface.description}}
 switchport mode {{iface.mode}}
{% if iface.mode == "access" %} switchport access vlan {{iface.access_vlan}}
{% else %} switchport trunk allowed vlan {{iface.trunk_vlans}}
 switchport trunk native vlan {{iface.native_vlan}}
{% endif %} spanning-tree portfast{% if iface.bpdu_guard %}
 spanning-tree bpduguard enable{% endif %}
 no shutdown
{% endfor %}!
interface Vlan1
 no ip address
 shutdown
!
interface Vlan{{MgmtVLAN}}
 description Management VLAN
 ip address {{MgmtIP}} {{MgmtSubnet}}
 no shutdown
!
ip default-gateway {{Gateway}}
!
ip access-list extended MGMT-ACCESS
 permit tcp {{MgmtNetwork}} {{MgmtWildcard}} any eq 22
 permit tcp {{MgmtNetwork}} {{MgmtWildcard}} any eq 443
 permit udp {{MgmtNetwork}} {{MgmtWildcard}} any eq 161
 permit icmp {{MgmtNetwork}} {{MgmtWildcard}} any
 deny ip any any log
!
ip access-list extended DENY-RFC1918
 deny ip 10.0.0.0 0.255.255.255 any
 deny ip 172.16.0.0 0.15.255.255 any
 deny ip 192.168.0.0 0.0.255.255 any
 permit ip any any
!
snmp-server community {{SNMPReadOnly}} RO
snmp-server community {{SNMPReadWrite}} RW
snmp-server location {{Location}}
snmp-server contact {{Contact}}
snmp-server enable traps snmp linkdown linkup coldstart warmstart
snmp-server enable traps syslog
snmp-server host {{SNMPServer}} version 2c {{SNMPReadOnly}}
!
logging trap informational
logging facility local7
logging source-interface Vlan{{MgmtVLAN}}
logging host {{SyslogServer1}}
logging host {{SyslogServer2}}
!
ntp server {{NTPServer1}} prefer
ntp server {{NTPServer2}}
ntp server {{NTPServer3}}
!
banner motd ^
===============================================================
                     AUTHORIZED ACCESS ONLY
===============================================================
  Hostname: {{Hostname}}
  Location: {{Location}}

  This system is for authorized use only. All activities are
  monitored and logged. Unauthorized access is prohibited and
  will be prosecuted to the fullest extent of the law.

  Contact: {{Contact}}
===============================================================
^
!
line con 0
 exec-timeout 15 0
 logging synchronous
 login local
!
line vty 0 4
 access-class MGMT-ACCESS in
 exec-timeout 15 0
 logging synchronous
 login local
 transport input ssh
!
line vty 5 15
 access-class MGMT-ACCESS in
 exec-timeout 15 0
 logging synchronous
 login local
 transport input ssh
!
end
"#;

#[derive(serde::Serialize)]
pub(crate) struct TemplateBenchResponse {
    status: &'static str,
    elapsed_ms: f64,
    output_len: usize,
}

#[derive(serde::Serialize)]
struct VlanData {
    id: i32,
    name: String,
}

#[derive(serde::Serialize)]
struct InterfaceData {
    name: String,
    description: String,
    mode: String,
    access_vlan: i32,
    trunk_vlans: String,
    native_vlan: i32,
    bpdu_guard: bool,
}

/// Render a single large enterprise switch config
fn render_large_template() -> String {
    use tera::{Context, Tera};

    let mut tera = Tera::default();
    tera.add_raw_template("config", LARGE_CONFIG_TEMPLATE).unwrap();

    // Generate 20 VLANs
    let vlans: Vec<VlanData> = (0..20)
        .map(|i| VlanData {
            id: 10 + i * 10,
            name: format!("VLAN_{}_Network", 10 + i * 10),
        })
        .collect();

    // Generate 48 interfaces
    let interfaces: Vec<InterfaceData> = (0..48)
        .map(|i| {
            let port = i + 1;
            if i < 44 {
                InterfaceData {
                    name: format!("GigabitEthernet1/0/{}", port),
                    description: format!("User Port {} - Floor {}", port, (i / 12) + 1),
                    mode: "access".to_string(),
                    access_vlan: 10 + (i % 20) * 10,
                    trunk_vlans: String::new(),
                    native_vlan: 0,
                    bpdu_guard: true,
                }
            } else {
                InterfaceData {
                    name: format!("GigabitEthernet1/0/{}", port),
                    description: format!("Uplink to Core Switch {}", port - 44),
                    mode: "trunk".to_string(),
                    access_vlan: 0,
                    trunk_vlans: "10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200".to_string(),
                    native_vlan: 999,
                    bpdu_guard: false,
                }
            }
        })
        .collect();

    let mut context = Context::new();
    context.insert("Hostname", "dc1-access-sw01");
    context.insert("Timestamp", &chrono::Utc::now().to_rfc3339());
    context.insert("MAC", "00:11:22:33:44:55");
    context.insert("SerialNumber", "FDO2345X0AB");
    context.insert("AdminUser", "admin");
    context.insert("AdminPassword", "SecureAdminPass123!");
    context.insert("OperatorPassword", "OperatorPass456!");
    context.insert("ReadonlyPassword", "ReadOnlyPass789!");
    context.insert("Timezone", "EST");
    context.insert("TimezoneOffset", "-5");
    context.insert("DomainName", "corp.example.com");
    context.insert("DNS1", "10.1.1.10");
    context.insert("DNS2", "10.1.1.11");
    context.insert("VLANs", &vlans);
    context.insert("Interfaces", &interfaces);
    context.insert("STPPriority", &28672);
    context.insert("MgmtVLAN", &100);
    context.insert("MgmtIP", "10.100.1.10");
    context.insert("MgmtSubnet", "255.255.255.0");
    context.insert("MgmtNetwork", "10.100.0.0");
    context.insert("MgmtWildcard", "0.0.255.255");
    context.insert("Gateway", "10.100.1.1");
    context.insert("SNMPReadOnly", "public_ro_community");
    context.insert("SNMPReadWrite", "private_rw_community");
    context.insert("Location", "Data Center 1, Row 5, Rack 12");
    context.insert("Contact", "noc@example.com +1-555-123-4567");
    context.insert("SNMPServer", "10.1.1.50");
    context.insert("SyslogServer1", "10.1.1.51");
    context.insert("SyslogServer2", "10.1.1.52");
    context.insert("NTPServer1", "10.1.1.1");
    context.insert("NTPServer2", "10.1.1.2");
    context.insert("NTPServer3", "pool.ntp.org");

    tera.render("config", &context).unwrap()
}

/// Simple template for basic variable substitution benchmark
const SIMPLE_CONFIG_TEMPLATE: &str = r#"!
hostname {{Hostname}}
!
interface Vlan1
 ip address {{IP}} {{Subnet}}
 no shutdown
!
ip default-gateway {{Gateway}}
!
end
"#;

/// Render a simple config with basic variable substitution
fn render_simple_template() -> String {
    use tera::{Context, Tera};

    let mut tera = Tera::default();
    tera.add_raw_template("simple", SIMPLE_CONFIG_TEMPLATE).unwrap();

    let mut context = Context::new();
    context.insert("Hostname", "simple-switch");
    context.insert("IP", "192.168.1.10");
    context.insert("Subnet", "255.255.255.0");
    context.insert("Gateway", "192.168.1.1");

    tera.render("simple", &context).unwrap()
}

/// Simple template handler
pub async fn template_simple_handler(_auth: crate::auth::AuthUser) -> Json<TemplateBenchResponse> {
    let start = std::time::Instant::now();
    let output = render_simple_template();
    let elapsed = start.elapsed();

    Json(TemplateBenchResponse {
        status: "ok",
        elapsed_ms: elapsed.as_secs_f64() * 1000.0,
        output_len: output.len(),
    })
}

/// Large template handler
pub async fn template_large_handler(_auth: crate::auth::AuthUser) -> Json<TemplateBenchResponse> {
    let start = std::time::Instant::now();
    let output = render_large_template();
    let elapsed = start.elapsed();

    Json(TemplateBenchResponse {
        status: "ok",
        elapsed_ms: elapsed.as_secs_f64() * 1000.0,
        output_len: output.len(),
    })
}

/// ACL template with 1000 terms for loop iteration benchmark
const ACL_CONFIG_TEMPLATE: &str = r#"!
! ============================================================
! Large ACL Configuration - {{ACLName}}
! Total Terms: {{TermCount}}
! Generated: {{Timestamp}}
! ============================================================
!
ip access-list extended {{ACLName}}
{% for term in Terms %} {{term.action}} {{term.protocol}} {{term.src_ip}} {{term.src_wildcard}} {{term.dst_ip}} {{term.dst_wildcard}}{% if term.dst_port %} eq {{term.dst_port}}{% endif %}
{% endfor %}!
end
"#;

#[derive(serde::Serialize)]
struct ACLTerm {
    action: String,
    protocol: String,
    src_ip: String,
    src_wildcard: &'static str,
    dst_ip: String,
    dst_wildcard: &'static str,
    dst_port: String,
}

/// Render a large ACL with the specified number of terms
fn render_acl_template(num_terms: usize) -> String {
    use tera::{Context, Tera};

    let mut tera = Tera::default();
    tera.add_raw_template("acl", ACL_CONFIG_TEMPLATE).unwrap();

    let ports = ["22", "80", "443", "8080", "3306", "5432", "6379", "27017"];

    // Generate ACL terms
    let terms: Vec<ACLTerm> = (0..num_terms)
        .map(|i| {
            let action = if i % 10 == 9 { "deny" } else { "permit" };
            let protocol = match i % 4 {
                1 => "udp",
                2 => "icmp",
                3 => "ip",
                _ => "tcp",
            };
            let port = if protocol == "tcp" || protocol == "udp" {
                ports[i % ports.len()].to_string()
            } else {
                String::new()
            };

            ACLTerm {
                action: action.to_string(),
                protocol: protocol.to_string(),
                src_ip: format!("10.{}.{}.0", (i / 256) % 256, i % 256),
                src_wildcard: "0.0.0.255",
                dst_ip: format!("172.16.{}.0", i % 256),
                dst_wildcard: "0.0.0.255",
                dst_port: port,
            }
        })
        .collect();

    let mut context = Context::new();
    context.insert("ACLName", &format!("LARGE-ACL-{}", num_terms));
    context.insert("TermCount", &num_terms);
    context.insert("Timestamp", &chrono::Utc::now().to_rfc3339());
    context.insert("Terms", &terms);

    tera.render("acl", &context).unwrap()
}

/// ACL template handler (1000 terms)
pub async fn template_acl_handler(_auth: crate::auth::AuthUser) -> Json<TemplateBenchResponse> {
    let start = std::time::Instant::now();
    let output = render_acl_template(1000);
    let elapsed = start.elapsed();

    Json(TemplateBenchResponse {
        status: "ok",
        elapsed_ms: elapsed.as_secs_f64() * 1000.0,
        output_len: output.len(),
    })
}

/// ACL template handler (10000 terms)
pub async fn template_acl10k_handler(_auth: crate::auth::AuthUser) -> Json<TemplateBenchResponse> {
    let start = std::time::Instant::now();
    let output = render_acl_template(10000);
    let elapsed = start.elapsed();

    Json(TemplateBenchResponse {
        status: "ok",
        elapsed_ms: elapsed.as_secs_f64() * 1000.0,
        output_len: output.len(),
    })
}
