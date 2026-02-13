use std::env;

/// Config holds all application configuration
#[derive(Debug, Clone)]
pub struct Config {
    pub db_path: String,
    pub db_max_connections: u32,
    pub dnsmasq_config: String,
    pub tftp_dir: String,
    pub templates_dir: String,
    pub backup_dir: String,
    pub lease_path: String,
    pub dnsmasq_pid: String,
    pub listen_addr: String,
    pub dhcp_interface: String,
    pub frontend_dir: String,
    pub jwt_secret: String,
}

impl Config {
    /// Load configuration from environment variables with defaults
    pub fn load() -> Self {
        Self {
            db_path: get_env("DB_PATH", "/data/ztp.db"),
            db_max_connections: get_env("DB_MAX_CONNECTIONS", "5")
                .parse()
                .unwrap_or(5),
            dnsmasq_config: get_env("DNSMASQ_CONFIG", "/dnsmasq/dnsmasq.conf"),
            tftp_dir: get_env("TFTP_DIR", "/tftp"),
            templates_dir: get_env("TEMPLATES_DIR", "/configs/templates"),
            backup_dir: get_env("BACKUP_DIR", "/backups"),
            lease_path: get_env("LEASE_PATH", "/var/lib/misc/dnsmasq.leases"),
            dnsmasq_pid: get_env("DNSMASQ_PID", "/var/run/dnsmasq.pid"),
            listen_addr: get_env("LISTEN_ADDR", "0.0.0.0:8080"),
            dhcp_interface: get_env("DHCP_INTERFACE", "eth0"),
            frontend_dir: get_env("FRONTEND_DIR", "/app/frontend"),
            jwt_secret: get_env("JWT_SECRET", ""),
        }
    }
}

fn get_env(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}
