use sqlx::{Row, sqlite::SqliteRow};

use crate::models::*;

/// Filter empty strings to None — used when DB stores '' instead of NULL
pub fn none_if_empty(opt: Option<String>) -> Option<String> {
    opt.filter(|s| !s.is_empty())
}

/// Map a SQLite row to a Device struct
pub fn map_device_row(row: &SqliteRow) -> Device {
    Device {
        id: row.get("id"),
        mac: row.get::<Option<String>, _>("mac"),
        ip: row.get("ip"),
        hostname: row.get("hostname"),
        vendor: none_if_empty(row.get("vendor")),
        model: none_if_empty(row.get("model")),
        serial_number: none_if_empty(row.get("serial_number")),
        config_template: row.get("config_template"),
        ssh_user: none_if_empty(row.get("ssh_user")),
        ssh_pass: none_if_empty(row.get("ssh_pass")),
        topology_id: row.try_get::<Option<i64>, _>("topology_id").ok().flatten(),
        topology_role: none_if_empty(row.get("topology_role")),
        hall_id: row.try_get::<Option<i64>, _>("hall_id").ok().flatten(),
        row_id: row.try_get::<Option<i64>, _>("row_id").ok().flatten(),
        rack_id: row.try_get::<Option<i64>, _>("rack_id").ok().flatten(),
        rack_position: {
            let v: i32 = row.get("rack_position");
            if v == 0 { None } else { Some(v) }
        },
        status: row.get("status"),
        device_type: row.get("device_type"),
        last_seen: row.get("last_seen"),
        last_backup: row.get("last_backup"),
        last_error: none_if_empty(row.get("last_error")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Map a SQLite row to a Vendor struct
pub fn map_vendor_row(row: &SqliteRow) -> Vendor {
    let mac_prefixes_json: String = row.get("mac_prefixes");
    let mac_prefixes: Vec<String> = serde_json::from_str(&mac_prefixes_json).unwrap_or_default();
    Vendor {
        id: row.get("id"),
        name: row.get("name"),
        backup_command: row.get("backup_command"),
        deploy_command: row.get::<String, _>("deploy_command"),
        diff_command: row.get::<String, _>("diff_command"),
        ssh_port: row.get("ssh_port"),
        ssh_user: none_if_empty(row.get("ssh_user")),
        ssh_pass: none_if_empty(row.get("ssh_pass")),
        mac_prefixes,
        vendor_class: row.get("vendor_class"),
        default_template: row.get("default_template"),
        device_count: Some(row.get("device_count")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Map a SQLite row to a Template struct
pub fn map_template_row(row: &SqliteRow) -> Template {
    Template {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        vendor_id: row.try_get::<Option<i64>, _>("vendor_id").ok().flatten(),
        content: row.get("content"),
        device_count: Some(row.get("device_count")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Map a SQLite row to a DhcpOption struct
pub fn map_dhcp_option_row(row: &SqliteRow) -> DhcpOption {
    let enabled: i32 = row.get("enabled");
    DhcpOption {
        id: row.get("id"),
        option_number: row.get("option_number"),
        name: row.get("name"),
        value: row.get("value"),
        option_type: row.get("type"),
        vendor_id: row.try_get::<Option<i64>, _>("vendor_id").ok().flatten(),
        description: none_if_empty(row.get("description")),
        enabled: enabled == 1,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Map a SQLite row to a DiscoveryLog struct
pub fn map_discovery_log_row(row: &SqliteRow) -> DiscoveryLog {
    DiscoveryLog {
        id: row.get("id"),
        event_type: row.get("event_type"),
        mac: row.get("mac"),
        ip: row.get("ip"),
        hostname: none_if_empty(row.get("hostname")),
        vendor: none_if_empty(row.get("vendor")),
        message: none_if_empty(row.get("message")),
        created_at: row.get("created_at"),
    }
}

/// Map a SQLite row to a Backup struct
pub fn map_backup_row(row: &SqliteRow) -> Backup {
    Backup {
        id: row.get("id"),
        device_id: row.get("device_id"),
        filename: row.get("filename"),
        size: row.get("size"),
        created_at: row.get("created_at"),
    }
}

/// Map a SQLite row to a Topology struct (with aggregated device counts)
pub fn map_topology_row(row: &SqliteRow) -> Topology {
    Topology {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        region_id: row.try_get::<Option<i64>, _>("region_id").ok().flatten(),
        campus_id: row.try_get::<Option<i64>, _>("campus_id").ok().flatten(),
        datacenter_id: row.try_get::<Option<i64>, _>("datacenter_id").ok().flatten(),
        device_count: Some(row.get("device_count")),
        super_spine_count: Some(row.get("super_spine_count")),
        spine_count: Some(row.get("spine_count")),
        leaf_count: Some(row.get("leaf_count")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

/// Map a SQLite row from discovered_devices to a Lease struct
pub fn map_discovered_device_row(row: &SqliteRow) -> Lease {
    let expires_at: Option<chrono::DateTime<chrono::Utc>> = row.get("expires_at");
    Lease {
        expiry_time: expires_at.map(|dt| dt.timestamp()).unwrap_or(0),
        mac: row.get("mac"),
        ip: row.get("ip"),
        hostname: row.get("hostname"),
        client_id: None,
        vendor: none_if_empty(row.get("vendor")),
        model: none_if_empty(row.get("model")),
        serial_number: none_if_empty(row.get("serial_number")),
        vendor_class: none_if_empty(row.get("vendor_class")),
        user_class: none_if_empty(row.get("user_class")),
        dhcp_client_id: none_if_empty(row.get("dhcp_client_id")),
        requested_options: none_if_empty(row.get("requested_options")),
        relay_address: none_if_empty(row.get("relay_address")),
        circuit_id: none_if_empty(row.get("circuit_id")),
        remote_id: none_if_empty(row.get("remote_id")),
        subscriber_id: none_if_empty(row.get("subscriber_id")),
    }
}
