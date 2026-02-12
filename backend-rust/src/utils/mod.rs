use std::io::Read;
use std::net::TcpStream;
use std::time::Duration;

/// Keyboard-interactive prompt handler that always responds with the password
struct PasswordPrompt {
    password: String,
}

impl ssh2::KeyboardInteractivePrompt for PasswordPrompt {
    fn prompt<'a>(
        &mut self,
        _username: &str,
        _instructions: &str,
        prompts: &[ssh2::Prompt<'a>],
    ) -> Vec<String> {
        prompts.iter().map(|_| self.password.clone()).collect()
    }
}

/// Normalize MAC address to lowercase with colons
pub fn normalize_mac(mac: &str) -> String {
    // Remove any existing separators
    let clean: String = mac
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect();

    // Convert to lowercase and insert colons
    if clean.len() != 12 {
        return mac.to_lowercase();
    }

    clean
        .chars()
        .collect::<Vec<_>>()
        .chunks(2)
        .map(|c| c.iter().collect::<String>())
        .collect::<Vec<_>>()
        .join(":")
        .to_lowercase()
}

/// Convert a MAC address to a config filename
/// e.g., "00:1c:73:aa:bb:cc" -> "00_1c_73_aa_bb_cc.cfg"
pub fn mac_to_config_filename(mac: &str) -> String {
    format!("{}.cfg", mac.replace(':', "_"))
}

/// Validate an IPv4 address (e.g., "192.168.1.1").
/// Returns true if the string is a valid dotted-decimal IPv4 address.
pub fn is_valid_ipv4(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| p.parse::<u8>().is_ok())
}

/// Validate a hostname.
/// Allows alphanumeric, hyphens, dots, and underscores. No path separators or shell metacharacters.
pub fn is_valid_hostname(hostname: &str) -> bool {
    if hostname.is_empty() || hostname.len() > 253 {
        return false;
    }
    hostname.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

/// Create an SSH session and authenticate with password + keyboard-interactive.
/// Returns the authenticated Session. Uses the ssh2 crate (libssh2).
/// This is blocking, so call from a spawn_blocking context.
pub fn ssh_connect(host: &str, user: &str, pass: &str, timeout_secs: u64) -> Result<ssh2::Session, String> {
    let addr = format!("{}:22", host);
    let tcp = TcpStream::connect_timeout(
        &addr.parse().map_err(|e| format!("Invalid address {}: {}", addr, e))?,
        Duration::from_secs(timeout_secs),
    )
    .map_err(|e| format!("TCP connection failed: {}", e))?;

    tcp.set_read_timeout(Some(Duration::from_secs(timeout_secs)))
        .ok();
    tcp.set_write_timeout(Some(Duration::from_secs(timeout_secs)))
        .ok();

    let mut session = ssh2::Session::new()
        .map_err(|e| format!("Failed to create SSH session: {}", e))?;
    session.set_tcp_stream(tcp);
    session.set_timeout(timeout_secs as u32 * 1000);
    session.handshake()
        .map_err(|e| format!("SSH handshake failed: {}", e))?;

    // Try password auth first
    match session.userauth_password(user, pass) {
        Ok(_) if session.authenticated() => return Ok(session),
        _ => {}
    }

    // Try keyboard-interactive auth (needed for Arista EOS and similar)
    let mut prompter = PasswordPrompt { password: pass.to_string() };
    let _ = session.userauth_keyboard_interactive(user, &mut prompter);

    if session.authenticated() {
        Ok(session)
    } else {
        Err("SSH authentication failed: all methods exhausted".to_string())
    }
}

/// Connect via SSH and run a single command, returning the output.
/// This is blocking, so call from a spawn_blocking context.
pub fn ssh_run_command(host: &str, user: &str, pass: &str, command: &str) -> Result<String, String> {
    let session = ssh_connect(host, user, pass, 30)?;

    let mut channel = session.channel_session()
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    channel.exec(command)
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let mut output = String::new();
    channel.read_to_string(&mut output)
        .map_err(|e| format!("Failed to read output: {}", e))?;

    channel.wait_close()
        .map_err(|e| format!("Failed to close channel: {}", e))?;

    Ok(output)
}

/// Async wrapper for ssh_run_command - runs in a blocking thread pool
pub async fn ssh_run_command_async(host: &str, user: &str, pass: &str, command: &str) -> Result<String, String> {
    let host = host.to_string();
    let user = user.to_string();
    let pass = pass.to_string();
    let command = command.to_string();

    tokio::task::spawn_blocking(move || {
        ssh_run_command(&host, &user, &pass, &command)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Async wrapper for ssh_connect - runs in a blocking thread pool.
/// Tests SSH connectivity and tries to run uptime commands.
pub async fn ssh_test_connection(host: &str, user: &str, pass: &str) -> (bool, Option<String>, Option<String>) {
    let host = host.to_string();
    let user = user.to_string();
    let pass = pass.to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
        let session = ssh_connect(&host, &user, &pass, 10)?;

        // Try uptime commands
        for cmd in &["uptime", "show version | include uptime"] {
            let mut channel = match session.channel_session() {
                Ok(ch) => ch,
                Err(e) => return Ok(format!("Connected (session error: {})", e)),
            };

            if channel.exec(cmd).is_ok() {
                let mut output = String::new();
                if channel.read_to_string(&mut output).is_ok() && !output.trim().is_empty() {
                    let _ = channel.wait_close();
                    return Ok(output.trim().to_string());
                }
            }
            let _ = channel.wait_close();
        }

        Ok("Connected (uptime command not available)".to_string())
    })
    .await;

    match result {
        Ok(Ok(uptime)) => (true, Some(uptime), None),
        Ok(Err(e)) => (false, None, Some(e)),
        Err(e) => (false, None, Some(format!("Task error: {}", e))),
    }
}

/// Result from probing a device via SSH
pub struct DeviceProbeResult {
    pub uptime: Option<String>,
    pub hostname: Option<String>,
    pub version: Option<String>,
    pub interfaces: Option<String>,
}

/// Execute a command on an existing SSH session, returning trimmed output or None
fn ssh_exec_on_session(session: &ssh2::Session, cmd: &str) -> Option<String> {
    let mut channel = session.channel_session().ok()?;
    if channel.exec(cmd).is_err() {
        let _ = channel.wait_close();
        return None;
    }
    let mut output = String::new();
    if channel.read_to_string(&mut output).is_ok() && !output.trim().is_empty() {
        let _ = channel.wait_close();
        let trimmed = output.trim().to_string();
        // Skip outputs that look like error messages
        if trimmed.starts_with('%') || trimmed.contains("Invalid input") || trimmed.contains("not found") {
            return None;
        }
        Some(trimmed)
    } else {
        let _ = channel.wait_close();
        None
    }
}

/// Try multiple commands on a session, returning the first successful output
fn try_first(session: &ssh2::Session, commands: &[&str]) -> Option<String> {
    for cmd in commands {
        if let Some(output) = ssh_exec_on_session(session, cmd) {
            return Some(output);
        }
    }
    None
}

/// Truncate output to a maximum number of lines
fn truncate_lines(s: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = s.lines().collect();
    if lines.len() <= max_lines {
        s.to_string()
    } else {
        let truncated: Vec<&str> = lines[..max_lines].to_vec();
        format!("{}\n... ({} more lines)", truncated.join("\n"), lines.len() - max_lines)
    }
}

/// Probe a device via SSH with vendor-aware commands.
/// Connects once and runs multiple commands on the same session.
/// Returns (connected, probe_result, error)
pub async fn ssh_probe_device(
    host: &str,
    user: &str,
    pass: &str,
    vendor_hint: Option<&str>,
) -> (bool, DeviceProbeResult, Option<String>) {
    let host = host.to_string();
    let user = user.to_string();
    let pass = pass.to_string();
    let vendor_hint = vendor_hint.map(|s| s.to_string());

    let result = tokio::task::spawn_blocking(move || -> Result<DeviceProbeResult, String> {
        let session = ssh_connect(&host, &user, &pass, 15)?;

        let is_linux = matches!(
            vendor_hint.as_deref(),
            Some("opengear") | Some("raspberry-pi") | Some("linux") | Some("frr") | Some("gobgp")
        );

        let (uptime, hostname, version, interfaces) = if is_linux {
            // Linux-style commands
            let uptime = try_first(&session, &["uptime"]);
            let hostname = try_first(&session, &["hostname"]);
            let version = try_first(&session, &["uname -a", "cat /etc/os-release"]);
            let interfaces = try_first(&session, &["ip -brief addr show", "ip addr show"]);
            (uptime, hostname, version, interfaces)
        } else {
            // Network device commands (Cisco, Arista, Juniper, etc.)
            let uptime = try_first(&session, &[
                "show version | include uptime",
                "show version | match uptime",
                "show system uptime",
                "uptime",
            ]);
            let hostname = try_first(&session, &[
                "show hostname",
                "show running-config | include hostname",
                "hostname",
            ]);
            let version = try_first(&session, &[
                "show version",
            ]);
            let interfaces = try_first(&session, &[
                "show ip interface brief",
                "show interfaces terse",
                "show interface brief",
                "ip -brief addr show",
            ]);
            (uptime, hostname, version, interfaces)
        };

        Ok(DeviceProbeResult {
            uptime,
            hostname,
            version: version.map(|v| truncate_lines(&v, 20)),
            interfaces: interfaces.map(|i| truncate_lines(&i, 30)),
        })
    })
    .await;

    match result {
        Ok(Ok(probe)) => (true, probe, None),
        Ok(Err(e)) => (
            false,
            DeviceProbeResult {
                uptime: None,
                hostname: None,
                version: None,
                interfaces: None,
            },
            Some(e),
        ),
        Err(e) => (
            false,
            DeviceProbeResult {
                uptime: None,
                hostname: None,
                version: None,
                interfaces: None,
            },
            Some(format!("Task error: {}", e)),
        ),
    }
}

/// Look up vendor by MAC address OUI (first 3 bytes) against known vendor prefixes.
/// Returns the vendor ID if a match is found.
pub fn lookup_vendor_by_mac(mac: &str, vendors: &[crate::models::Vendor]) -> Option<String> {
    let normalized: String = mac.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if normalized.len() < 6 {
        return None;
    }

    // Extract OUI (first 3 bytes)
    let oui = format!(
        "{}:{}:{}",
        &normalized[0..2],
        &normalized[2..4],
        &normalized[4..6]
    )
    .to_uppercase();

    for vendor in vendors {
        for prefix in &vendor.mac_prefixes {
            if prefix.to_uppercase() == oui {
                return Some(vendor.id.clone());
            }
        }
    }

    None
}

/// DHCP info captured by the dhcp-notify.sh script for a single lease event
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct DhcpInfo {
    pub mac: String,
    pub ip: String,
    #[serde(default)]
    pub hostname: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub vendor_class: Option<String>,
    #[serde(default)]
    pub supplied_hostname: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub user_class: Option<String>,
    #[serde(default)]
    pub requested_options: Option<String>,
    #[serde(default)]
    pub tags: Option<String>,
    #[serde(default)]
    pub interface: Option<String>,
    #[serde(default)]
    pub relay_address: Option<String>,
    #[serde(default)]
    pub circuit_id: Option<String>,
    #[serde(default)]
    pub remote_id: Option<String>,
    #[serde(default)]
    pub subscriber_id: Option<String>,
    #[serde(default)]
    pub cpewan_oui: Option<String>,
    #[serde(default)]
    pub cpewan_serial: Option<String>,
    #[serde(default)]
    pub cpewan_class: Option<String>,
    #[serde(default)]
    pub lease_expires: Option<i64>,
    #[serde(default)]
    pub time_remaining: Option<i64>,
    #[serde(default)]
    pub timestamp: Option<i64>,
}

/// Read DHCP info captured by the dhcp-notify.sh script.
/// Returns the most recent DhcpInfo for a given MAC address.
pub fn read_dhcp_info_for_mac(mac: &str) -> Option<DhcpInfo> {
    let path = std::env::var("DHCP_INFO_FILE")
        .unwrap_or_else(|_| "/data/dhcp-info.json".to_string());

    let content = std::fs::read_to_string(&path).ok()?;
    let normalized_mac = normalize_mac(mac);

    // Read JSON lines in reverse to find most recent entry for this MAC
    for line in content.lines().rev() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if let Ok(info) = serde_json::from_str::<DhcpInfo>(line) {
            if normalize_mac(&info.mac) == normalized_mac {
                return Some(info);
            }
        }
    }

    None
}

/// Convenience wrapper: read just the vendor_class for a MAC
pub fn read_vendor_class_for_mac(mac: &str) -> Option<String> {
    read_dhcp_info_for_mac(mac).and_then(|info| info.vendor_class)
}

/// Match a DHCP vendor class string to a known vendor ID.
/// Compares the vendor_class field of each vendor against the provided string.
pub fn match_vendor_class(vendor_class: &str, vendors: &[crate::models::Vendor]) -> Option<String> {
    let lower = vendor_class.to_lowercase();
    for vendor in vendors {
        if !vendor.vendor_class.is_empty()
            && lower.contains(&vendor.vendor_class.to_lowercase())
        {
            return Some(vendor.id.clone());
        }
    }
    None
}

/// Map a DHCP option number to its human-readable name
fn dhcp_option_name(num: &str) -> &str {
    match num.trim() {
        "1" => "subnet-mask",
        "2" => "time-offset",
        "3" => "router",
        "6" => "dns",
        "12" => "hostname",
        "15" => "domain-name",
        "28" => "broadcast",
        "42" => "ntp-server",
        "43" => "vendor-specific",
        "51" => "lease-time",
        "54" => "dhcp-server",
        "58" => "renewal-time",
        "59" => "rebinding-time",
        "60" => "vendor-class",
        "61" => "client-id",
        "66" => "tftp-server",
        "67" => "bootfile",
        "77" => "user-class",
        "82" => "relay-agent",
        "150" => "tftp-server-addr",
        other => other,
    }
}

/// Convert a comma-separated list of DHCP option numbers to readable names
pub fn humanize_requested_options(raw: &str) -> String {
    raw.split(',')
        .map(|n| dhcp_option_name(n))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Enrich a lease with DHCP info from dhcp-notify.sh script data
pub fn enrich_lease_with_dhcp_info(lease: &mut crate::models::Lease) {
    if let Some(info) = read_dhcp_info_for_mac(&lease.mac) {
        lease.vendor_class = info.vendor_class;
        lease.user_class = info.user_class.clone();
        lease.dhcp_client_id = info.client_id.clone();
        lease.requested_options = info.requested_options
            .map(|opts| humanize_requested_options(&opts));
        lease.relay_address = info.relay_address;
        lease.circuit_id = info.circuit_id;
        lease.remote_id = info.remote_id;
        lease.subscriber_id = info.subscriber_id;

        // Derive model: prefer cpewan_class, fall back to user_class
        lease.model = info.cpewan_class.or(info.user_class);

        // Derive serial number: prefer cpewan_serial, fall back to client_id
        lease.serial_number = info.cpewan_serial.or(info.client_id);
    }
}

/// Detect vendor for a MAC address using all available methods:
/// 1. DHCP vendor class (Option 60) from dhcp-script data
/// 2. MAC OUI prefix matching
/// Returns (vendor_id, detection_method)
pub fn detect_vendor(mac: &str, vendors: &[crate::models::Vendor]) -> Option<(String, &'static str)> {
    // Method 1: Check DHCP vendor class data (most reliable)
    if let Some(vendor_class) = read_vendor_class_for_mac(mac) {
        if let Some(vendor_id) = match_vendor_class(&vendor_class, vendors) {
            return Some((vendor_id, "dhcp-vendor-class"));
        }
    }

    // Method 2: MAC OUI prefix matching
    if let Some(vendor_id) = lookup_vendor_by_mac(mac, vendors) {
        return Some((vendor_id, "mac-prefix"));
    }

    None
}

/// Convert Go template syntax to Tera syntax.
/// Handles simple variables, range loops, conditionals, and whitespace trimming.
pub fn convert_go_template_to_tera(content: &str) -> String {
    // Detect if this is already Tera syntax (has {% or doesn't have {{.)
    if !content.contains("{{.") && !content.contains("{{ .") && !content.contains("{{-") {
        return content.to_string();
    }

    let mut result = content.to_string();

    // Handle whitespace-trimmed tags: {{- and -}}
    result = result.replace("{{- ", "{{ ");
    result = result.replace(" -}}", " }}");
    result = result.replace("{{-", "{{");
    result = result.replace("-}}", "}}");

    // Handle range loops: {{range .Items}} -> {% for item in Items %}
    // and {{end}} for range -> {% endfor %}
    // This is tricky because {{end}} is used for both range and if.
    // We'll do a simple pass: convert range/if/else/end blocks.

    // Convert range: {{range .Items}} -> {% for item in Items %}
    let range_re = regex_lite::Regex::new(r"\{\{range\s+\.(\w+)\}\}").ok();
    if let Some(re) = &range_re {
        result = re.replace_all(&result, "{% for item in $1 %}").to_string();
    }

    // Convert range with variable: {{range $key, $val := .Items}} -> {% for val in Items %}
    let range_kv_re = regex_lite::Regex::new(r"\{\{range\s+\$\w+,?\s*\$(\w+)\s*:=\s*\.(\w+)\}\}").ok();
    if let Some(re) = &range_kv_re {
        result = re.replace_all(&result, "{% for $1 in $2 %}").to_string();
    }

    // Convert if: {{if .Condition}} -> {% if Condition %}
    let if_re = regex_lite::Regex::new(r"\{\{if\s+\.(\w+)\}\}").ok();
    if let Some(re) = &if_re {
        result = re.replace_all(&result, "{% if $1 %}").to_string();
    }

    // Convert if with comparison: {{if eq .Field "value"}} -> {% if Field == "value" %}
    let if_eq_re = regex_lite::Regex::new(r#"\{\{if\s+eq\s+\.(\w+)\s+"([^"]+)"\}\}"#).ok();
    if let Some(re) = &if_eq_re {
        result = re.replace_all(&result, r#"{% if $1 == "$2" %}"#).to_string();
    }

    // Convert else
    result = result.replace("{{else}}", "{% else %}");

    // Convert end - need context to know if it's endfor or endif
    // Simple heuristic: track nesting
    let mut lines: Vec<String> = Vec::new();
    let mut block_stack: Vec<&str> = Vec::new(); // "for" or "if"

    for line in result.lines() {
        let trimmed = line.trim();
        if trimmed.contains("{% for ") {
            block_stack.push("for");
        }
        if trimmed.contains("{% if ") {
            block_stack.push("if");
        }

        let mut processed = line.to_string();
        if processed.contains("{{end}}") {
            match block_stack.pop() {
                Some("for") => processed = processed.replace("{{end}}", "{% endfor %}"),
                Some("if") => processed = processed.replace("{{end}}", "{% endif %}"),
                _ => processed = processed.replace("{{end}}", "{% endif %}"),
            }
        }
        lines.push(processed);
    }
    result = lines.join("\n");

    // Convert simple variable references: {{.Field}} -> {{Field}}
    result = result.replace("{{.", "{{");
    result = result.replace("{{ .", "{{ ");

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_mac() {
        assert_eq!(normalize_mac("AA:BB:CC:DD:EE:FF"), "aa:bb:cc:dd:ee:ff");
        assert_eq!(normalize_mac("AA-BB-CC-DD-EE-FF"), "aa:bb:cc:dd:ee:ff");
        assert_eq!(normalize_mac("AABBCCDDEEFF"), "aa:bb:cc:dd:ee:ff");
        assert_eq!(normalize_mac("aa:bb:cc:dd:ee:ff"), "aa:bb:cc:dd:ee:ff");
    }

    #[test]
    fn test_mac_to_config_filename() {
        assert_eq!(mac_to_config_filename("00:1c:73:aa:bb:cc"), "00_1c_73_aa_bb_cc.cfg");
    }

    #[test]
    fn test_go_template_simple() {
        let go = "hostname {{.Hostname}}\nip {{.IP}}";
        let tera = convert_go_template_to_tera(go);
        assert_eq!(tera, "hostname {{Hostname}}\nip {{IP}}");
    }

    #[test]
    fn test_tera_passthrough() {
        let tera = "hostname {{Hostname}}\nip {{IP}}";
        assert_eq!(convert_go_template_to_tera(tera), tera);
    }

    #[test]
    fn test_go_template_if() {
        let go = "{{if .Vendor}}has vendor{{else}}no vendor{{end}}";
        let tera = convert_go_template_to_tera(go);
        assert_eq!(tera, "{% if Vendor %}has vendor{% else %}no vendor{% endif %}");
    }

    #[test]
    fn test_go_template_range() {
        let go = "{{range .Items}}item{{end}}";
        let tera = convert_go_template_to_tera(go);
        assert_eq!(tera, "{% for item in Items %}item{% endfor %}");
    }

    #[test]
    fn test_is_valid_ipv4() {
        assert!(is_valid_ipv4("192.168.1.1"));
        assert!(is_valid_ipv4("0.0.0.0"));
        assert!(is_valid_ipv4("255.255.255.255"));
        assert!(!is_valid_ipv4(""));
        assert!(!is_valid_ipv4("not-an-ip"));
        assert!(!is_valid_ipv4("256.1.1.1"));
        assert!(!is_valid_ipv4("1.2.3"));
        assert!(!is_valid_ipv4("1.2.3.4.5"));
        assert!(!is_valid_ipv4("1.2.3.-1"));
        assert!(!is_valid_ipv4("; rm -rf /"));
    }

    #[test]
    fn test_is_valid_hostname() {
        assert!(is_valid_hostname("switch-01"));
        assert!(is_valid_hostname("router.lab.local"));
        assert!(is_valid_hostname("my_host"));
        assert!(!is_valid_hostname(""));
        assert!(!is_valid_hostname("host name")); // spaces
        assert!(!is_valid_hostname("host;rm")); // semicolon
        assert!(!is_valid_hostname("../etc/passwd")); // path traversal
        assert!(!is_valid_hostname("host\nname")); // newline
    }
}
