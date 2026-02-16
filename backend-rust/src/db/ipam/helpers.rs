use sqlx::{Row, sqlite::SqliteRow};

use crate::models::*;
use crate::db::row_helpers::none_if_empty;

pub(super) fn csv_to_vec(csv: Option<String>) -> Vec<String> {
    match csv {
        Some(s) if !s.is_empty() => s.split(',').map(|s| s.to_string()).collect(),
        _ => vec![],
    }
}

pub(super) fn csv_to_i64_vec(csv: Option<String>) -> Vec<i64> {
    match csv {
        Some(s) if !s.is_empty() => s.split(',').filter_map(|s| s.trim().parse::<i64>().ok()).collect(),
        _ => vec![],
    }
}

pub(super) fn map_region_row(row: &SqliteRow) -> IpamRegion {
    IpamRegion {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        campus_count: row.try_get("campus_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_campus_row(row: &SqliteRow) -> IpamCampus {
    IpamCampus {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        region_id: row.get("region_id"),
        region_name: row.try_get("region_name").ok(),
        datacenter_count: row.try_get("datacenter_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_datacenter_row(row: &SqliteRow) -> IpamDatacenter {
    IpamDatacenter {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        campus_id: row.get("campus_id"),
        campus_name: row.try_get("campus_name").ok(),
        region_name: row.try_get("region_name").ok(),
        hall_count: row.try_get("hall_count").ok(),
        prefix_count: row.try_get("prefix_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_hall_row(row: &SqliteRow) -> IpamHall {
    IpamHall {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        datacenter_id: row.get("datacenter_id"),
        datacenter_name: row.try_get("datacenter_name").ok(),
        row_count: row.try_get("row_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_ipam_row_row(row: &SqliteRow) -> IpamRow {
    IpamRow {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        hall_id: row.get("hall_id"),
        hall_name: row.try_get("hall_name").ok(),
        rack_count: row.try_get("rack_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_rack_row(row: &SqliteRow) -> IpamRack {
    IpamRack {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        row_id: row.get("row_id"),
        row_name: row.try_get("row_name").ok(),
        device_count: row.try_get("device_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_role_row(row: &SqliteRow) -> IpamRole {
    IpamRole {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        created_at: row.get("created_at"),
    }
}

pub(super) fn map_prefix_row(row: &SqliteRow) -> IpamPrefix {
    let is_supernet: i32 = row.get("is_supernet");
    IpamPrefix {
        id: row.get("id"),
        prefix: row.get("prefix"),
        network_int: row.get("network_int"),
        broadcast_int: row.get("broadcast_int"),
        prefix_length: row.get("prefix_length"),
        description: none_if_empty(row.get("description")),
        status: row.get("status"),
        is_supernet: is_supernet != 0,
        role_ids: csv_to_i64_vec(row.try_get("role_ids_csv").ok().and_then(|v: Option<String>| v)),
        role_names: csv_to_vec(row.try_get("role_names_csv").ok().and_then(|v: Option<String>| v)),
        parent_id: row.get("parent_id"),
        parent_prefix: row.try_get("parent_prefix").ok().and_then(|v: Option<String>| v),
        datacenter_id: row.try_get::<Option<i64>, _>("datacenter_id").ok().flatten(),
        datacenter_name: row.try_get("datacenter_name").ok().and_then(|v: Option<String>| v),
        vlan_id: row.get("vlan_id"),
        vrf_id: row.try_get::<Option<i64>, _>("vrf_id").ok().flatten(),
        vrf_name: row.try_get("vrf_name").ok().and_then(|v: Option<String>| v),
        child_prefix_count: row.try_get("child_prefix_count").ok(),
        ip_address_count: row.try_get("ip_address_count").ok(),
        utilization: None, // computed on demand
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_ip_address_row(row: &SqliteRow) -> IpamIpAddress {
    IpamIpAddress {
        id: row.get("id"),
        address: row.get("address"),
        address_int: row.get("address_int"),
        prefix_id: row.get("prefix_id"),
        prefix: row.try_get("prefix_cidr").ok().and_then(|v: Option<String>| v),
        description: none_if_empty(row.get("description")),
        status: row.get("status"),
        role_ids: csv_to_i64_vec(row.try_get("role_ids_csv").ok().and_then(|v: Option<String>| v)),
        role_names: csv_to_vec(row.try_get("role_names_csv").ok().and_then(|v: Option<String>| v)),
        dns_name: none_if_empty(row.get("dns_name")),
        device_id: row.try_get::<Option<i64>, _>("device_id").ok().flatten(),
        device_hostname: row.try_get("device_hostname").ok().and_then(|v: Option<String>| v),
        interface_name: none_if_empty(row.get("interface_name")),
        vrf_id: row.try_get::<Option<i64>, _>("vrf_id").ok().flatten(),
        vrf_name: row.try_get("vrf_name").ok().and_then(|v: Option<String>| v),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_vrf_row(row: &SqliteRow) -> IpamVrf {
    IpamVrf {
        id: row.get("id"),
        name: row.get("name"),
        rd: none_if_empty(row.get("rd")),
        description: none_if_empty(row.get("description")),
        tenant_id: row.try_get::<Option<i64>, _>("tenant_id").ok().flatten(),
        prefix_count: row.try_get("prefix_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub(super) fn map_tag_row(row: &SqliteRow) -> IpamTag {
    IpamTag {
        id: row.get("id"),
        resource_type: row.get("resource_type"),
        resource_id: row.get("resource_id"),
        key: row.get("key"),
        value: row.get("value"),
        created_at: row.get("created_at"),
    }
}
