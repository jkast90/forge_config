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

/// Resolve SSH credentials using the fallback chain:
/// explicit user/pass -> vendor defaults -> global settings
pub async fn resolve_ssh_credentials(
    store: &crate::db::Store,
    ssh_user: Option<String>,
    ssh_pass: Option<String>,
    vendor_id: Option<&str>,
) -> (String, String) {
    let settings = store.get_settings().await.unwrap_or_default();
    let vendor = match vendor_id {
        Some(v) if !v.is_empty() => {
            if let Ok(id) = v.parse::<i64>() {
                store.get_vendor(id).await.ok().flatten()
            } else {
                None
            }
        }
        _ => None,
    };
    let user = ssh_user.filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_user.clone()))
        .unwrap_or(settings.default_ssh_user);
    let pass = ssh_pass.filter(|s| !s.is_empty())
        .or_else(|| vendor.as_ref().and_then(|v| v.ssh_pass.clone()))
        .unwrap_or(settings.default_ssh_pass);
    (user, pass)
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

    let mut stdout = String::new();
    channel.read_to_string(&mut stdout)
        .map_err(|e| format!("Failed to read output: {}", e))?;

    let mut stderr = String::new();
    channel.stderr().read_to_string(&mut stderr)
        .map_err(|e| format!("Failed to read stderr: {}", e))?;

    channel.wait_close()
        .map_err(|e| format!("Failed to close channel: {}", e))?;

    // Combine stdout and stderr
    let output = if !stdout.is_empty() && !stderr.is_empty() {
        format!("{}\n{}", stdout, stderr)
    } else if !stderr.is_empty() {
        stderr
    } else {
        stdout
    };

    Ok(output)
}

/// Send multi-line commands via an interactive SSH shell (PTY).
/// This is needed for network devices (EOS, IOS, JunOS) that require
/// entering config mode interactively rather than via exec.
pub fn ssh_run_interactive(host: &str, user: &str, pass: &str, commands: &str) -> Result<String, String> {
    use std::io::Write;

    let session = ssh_connect(host, user, pass, 60)?;

    let mut channel = session.channel_session()
        .map_err(|e| format!("Failed to open channel: {}", e))?;

    // Request a PTY so EOS gives us an interactive CLI
    channel.request_pty("xterm", None, None)
        .map_err(|e| format!("Failed to request PTY: {}", e))?;

    channel.shell()
        .map_err(|e| format!("Failed to start shell: {}", e))?;

    // Helper: drain any available output from the channel (non-blocking)
    let drain = |ch: &mut ssh2::Channel, buf: &mut String| {
        let mut tmp = [0u8; 8192];
        loop {
            match ch.read(&mut tmp) {
                Ok(0) => break,
                Ok(n) => { buf.push_str(&String::from_utf8_lossy(&tmp[..n])); }
                Err(_) => break,
            }
        }
    };

    let mut output = String::new();

    // Wait for the initial prompt then drain it
    std::thread::sleep(Duration::from_secs(2));
    session.set_blocking(false);
    drain(&mut channel, &mut output);

    // Disable pager so show commands don't paginate with --More--
    session.set_blocking(true);
    channel.write_all(b"terminal length 0\n").ok();
    channel.flush().ok();
    std::thread::sleep(Duration::from_millis(500));
    session.set_blocking(false);
    drain(&mut channel, &mut output);

    // Send each line, draining output between commands
    for line in commands.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('!') {
            continue; // Skip empty lines and EOS comments
        }
        session.set_blocking(true);
        channel.write_all(format!("{}\n", line).as_bytes())
            .map_err(|e| format!("Failed to write command: {}", e))?;
        channel.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;
        // Give the device time to process and produce output
        std::thread::sleep(Duration::from_millis(500));
        session.set_blocking(false);
        drain(&mut channel, &mut output);
    }

    // Wait longer for any final output (show commands may take time)
    for _ in 0..10 {
        std::thread::sleep(Duration::from_millis(500));
        let before = output.len();
        drain(&mut channel, &mut output);
        // If no new output appeared, we're likely done
        if output.len() == before {
            break;
        }
    }

    // Send exit to close the session cleanly
    session.set_blocking(true);
    channel.write_all(b"exit\n").ok();
    channel.flush().ok();
    std::thread::sleep(Duration::from_millis(500));
    session.set_blocking(false);
    drain(&mut channel, &mut output);

    session.set_blocking(true);
    channel.wait_close().ok();

    Ok(output)
}

/// Async wrapper for ssh_run_interactive - runs in a blocking thread pool
pub async fn ssh_run_interactive_async(host: &str, user: &str, pass: &str, commands: &str) -> Result<String, String> {
    let host = host.to_string();
    let user = user.to_string();
    let pass = pass.to_string();
    let commands = commands.to_string();

    tokio::task::spawn_blocking(move || {
        ssh_run_interactive(&host, &user, &pass, &commands)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
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
#[allow(dead_code)]
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
                return Some(vendor.id.to_string());
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
            return Some(vendor.id.to_string());
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

// ========== CIDR Utilities for IPAM ==========

/// Parse a CIDR string like "10.0.0.0/8" into (network_u32, broadcast_u32, prefix_length)
pub fn parse_cidr(cidr: &str) -> Result<(u32, u32, u8), String> {
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return Err(format!("Invalid CIDR notation: {}", cidr));
    }
    let ip = parse_ipv4_to_u32(parts[0])?;
    let prefix_len: u8 = parts[1].parse()
        .map_err(|_| format!("Invalid prefix length: {}", parts[1]))?;
    if prefix_len > 32 {
        return Err(format!("Prefix length {} out of range (0-32)", prefix_len));
    }
    let mask = if prefix_len == 0 { 0u32 } else { !0u32 << (32 - prefix_len) };
    let network = ip & mask;
    let broadcast = network | !mask;
    Ok((network, broadcast, prefix_len))
}

/// Parse an IPv4 address string to u32
pub fn parse_ipv4_to_u32(ip: &str) -> Result<u32, String> {
    let octets: Vec<u8> = ip.split('.')
        .map(|o| o.parse::<u8>())
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(|_| format!("Invalid IPv4 address: {}", ip))?;
    if octets.len() != 4 {
        return Err(format!("Invalid IPv4 address: {}", ip));
    }
    Ok(((octets[0] as u32) << 24) | ((octets[1] as u32) << 16)
        | ((octets[2] as u32) << 8) | (octets[3] as u32))
}

/// Convert u32 to IPv4 dotted-decimal string
pub fn u32_to_ipv4(ip: u32) -> String {
    format!("{}.{}.{}.{}",
        (ip >> 24) & 0xFF, (ip >> 16) & 0xFF, (ip >> 8) & 0xFF, ip & 0xFF)
}

/// Format as CIDR string (e.g., "10.0.0.0/8")
pub fn format_cidr(network: u32, prefix_len: u8) -> String {
    format!("{}/{}", u32_to_ipv4(network), prefix_len)
}

/// Find the next available sub-prefix of a given length within a parent prefix.
/// `allocated` is a sorted list of (network_int, broadcast_int) for existing child prefixes.
pub fn next_available_prefix(
    parent_network: u32,
    parent_broadcast: u32,
    desired_prefix_len: u8,
    allocated: &[(u32, u32)],
) -> Option<(u32, u32)> {
    if desired_prefix_len > 32 {
        return None;
    }
    let block_size: u32 = 1u32.checked_shl(32 - desired_prefix_len as u32)?;
    let mask = if desired_prefix_len == 0 { 0 } else { !0u32 << (32 - desired_prefix_len) };

    let mut candidate = parent_network;

    loop {
        // Align candidate to block boundary
        let remainder = candidate & !mask;
        if remainder != 0 {
            candidate = (candidate & mask).checked_add(block_size)?;
        }

        let candidate_broadcast = candidate.checked_add(block_size - 1)?;
        if candidate_broadcast > parent_broadcast {
            return None; // No room left
        }

        // Check overlap with allocated blocks
        let mut overlaps = false;
        let mut jump_past: u32 = 0;
        for &(alloc_net, alloc_bcast) in allocated {
            // Two ranges overlap if they are not fully disjoint
            if !(candidate_broadcast < alloc_net || candidate > alloc_bcast) {
                overlaps = true;
                if alloc_bcast + 1 > jump_past {
                    jump_past = alloc_bcast + 1;
                }
            }
        }

        if !overlaps {
            return Some((candidate, candidate_broadcast));
        }

        // Jump past the overlapping allocation and re-align
        if jump_past == 0 || jump_past <= candidate {
            // Safety: move forward by one block to avoid infinite loop
            candidate = candidate.checked_add(block_size)?;
        } else {
            candidate = jump_past;
        }
    }
}

/// Find next available IP address in a prefix.
/// `allocated` is a sorted list of address_int for existing IPs.
/// Skips network address (first) and broadcast address (last) for prefixes < /31.
pub fn next_available_ip(
    prefix_network: u32,
    prefix_broadcast: u32,
    prefix_len: u8,
    allocated: &[u32],
) -> Option<u32> {
    let (start, end) = if prefix_len >= 31 {
        // /31 and /32: use all addresses (RFC 3021)
        (prefix_network, prefix_broadcast)
    } else {
        // Skip network and broadcast addresses
        (prefix_network + 1, prefix_broadcast - 1)
    };

    let alloc_set: std::collections::HashSet<u32> = allocated.iter().copied().collect();
    for candidate in start..=end {
        if !alloc_set.contains(&candidate) {
            return Some(candidate);
        }
    }
    None
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

    #[test]
    fn test_parse_cidr() {
        let (net, bcast, len) = parse_cidr("10.0.0.0/8").unwrap();
        assert_eq!(net, 0x0A000000);
        assert_eq!(bcast, 0x0AFFFFFF);
        assert_eq!(len, 8);

        let (net, bcast, len) = parse_cidr("192.168.1.0/24").unwrap();
        assert_eq!(u32_to_ipv4(net), "192.168.1.0");
        assert_eq!(u32_to_ipv4(bcast), "192.168.1.255");
        assert_eq!(len, 24);
    }

    #[test]
    fn test_parse_ipv4_to_u32() {
        assert_eq!(parse_ipv4_to_u32("10.0.0.1").unwrap(), 0x0A000001);
        assert_eq!(parse_ipv4_to_u32("255.255.255.255").unwrap(), 0xFFFFFFFF);
        assert_eq!(parse_ipv4_to_u32("0.0.0.0").unwrap(), 0);
        assert!(parse_ipv4_to_u32("invalid").is_err());
    }

    #[test]
    fn test_u32_to_ipv4_roundtrip() {
        assert_eq!(u32_to_ipv4(0x0A000001), "10.0.0.1");
        assert_eq!(u32_to_ipv4(0xC0A80164), "192.168.1.100");
    }

    #[test]
    fn test_next_available_prefix() {
        // 10.0.0.0/8, allocate /24s
        let (pnet, pbcast, _) = parse_cidr("10.0.0.0/8").unwrap();

        // No allocations yet — first /24 should be 10.0.0.0/24
        let result = next_available_prefix(pnet, pbcast, 24, &[]);
        assert!(result.is_some());
        let (net, bcast) = result.unwrap();
        assert_eq!(format_cidr(net, 24), "10.0.0.0/24");
        assert_eq!(u32_to_ipv4(bcast), "10.0.0.255");

        // With 10.0.0.0/24 allocated, next should be 10.0.1.0/24
        let allocated = vec![(net, bcast)];
        let result = next_available_prefix(pnet, pbcast, 24, &allocated);
        assert!(result.is_some());
        let (net2, _) = result.unwrap();
        assert_eq!(format_cidr(net2, 24), "10.0.1.0/24");
    }

    #[test]
    fn test_next_available_ip() {
        let (pnet, pbcast, plen) = parse_cidr("10.0.0.0/24").unwrap();

        // No allocations — first usable IP (skip network addr)
        let result = next_available_ip(pnet, pbcast, plen, &[]);
        assert_eq!(result, Some(parse_ipv4_to_u32("10.0.0.1").unwrap()));

        // With .1 allocated, next should be .2
        let allocated = vec![parse_ipv4_to_u32("10.0.0.1").unwrap()];
        let result = next_available_ip(pnet, pbcast, plen, &allocated);
        assert_eq!(result, Some(parse_ipv4_to_u32("10.0.0.2").unwrap()));
    }
}
