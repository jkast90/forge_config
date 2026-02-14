use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use crate::utils;
use super::row_helpers::none_if_empty;

// ========== Row Mappers ==========

fn map_region_row(row: &SqliteRow) -> IpamRegion {
    IpamRegion {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        location_count: row.try_get("location_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn map_location_row(row: &SqliteRow) -> IpamLocation {
    IpamLocation {
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

fn map_datacenter_row(row: &SqliteRow) -> IpamDatacenter {
    IpamDatacenter {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        location_id: row.get("location_id"),
        location_name: row.try_get("location_name").ok(),
        region_name: row.try_get("region_name").ok(),
        prefix_count: row.try_get("prefix_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn map_role_row(row: &SqliteRow) -> IpamRole {
    IpamRole {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        created_at: row.get("created_at"),
    }
}

fn map_prefix_row(row: &SqliteRow) -> IpamPrefix {
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
        role_ids: csv_to_vec(row.try_get("role_ids_csv").ok().and_then(|v: Option<String>| v)),
        role_names: csv_to_vec(row.try_get("role_names_csv").ok().and_then(|v: Option<String>| v)),
        parent_id: row.get("parent_id"),
        parent_prefix: row.try_get("parent_prefix").ok().and_then(|v: Option<String>| v),
        datacenter_id: none_if_empty(row.get("datacenter_id")),
        datacenter_name: row.try_get("datacenter_name").ok().and_then(|v: Option<String>| v),
        vlan_id: row.get("vlan_id"),
        vrf_id: none_if_empty(row.get("vrf_id")),
        vrf_name: row.try_get("vrf_name").ok().and_then(|v: Option<String>| v),
        child_prefix_count: row.try_get("child_prefix_count").ok(),
        ip_address_count: row.try_get("ip_address_count").ok(),
        utilization: None, // computed on demand
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn csv_to_vec(csv: Option<String>) -> Vec<String> {
    match csv {
        Some(s) if !s.is_empty() => s.split(',').map(|s| s.to_string()).collect(),
        _ => vec![],
    }
}

fn map_ip_address_row(row: &SqliteRow) -> IpamIpAddress {
    IpamIpAddress {
        id: row.get("id"),
        address: row.get("address"),
        address_int: row.get("address_int"),
        prefix_id: row.get("prefix_id"),
        prefix: row.try_get("prefix_cidr").ok().and_then(|v: Option<String>| v),
        description: none_if_empty(row.get("description")),
        status: row.get("status"),
        role_ids: csv_to_vec(row.try_get("role_ids_csv").ok().and_then(|v: Option<String>| v)),
        role_names: csv_to_vec(row.try_get("role_names_csv").ok().and_then(|v: Option<String>| v)),
        dns_name: none_if_empty(row.get("dns_name")),
        device_id: none_if_empty(row.get("device_id")),
        device_hostname: row.try_get("device_hostname").ok().and_then(|v: Option<String>| v),
        interface_name: none_if_empty(row.get("interface_name")),
        vrf_id: none_if_empty(row.get("vrf_id")),
        vrf_name: row.try_get("vrf_name").ok().and_then(|v: Option<String>| v),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn map_vrf_row(row: &SqliteRow) -> IpamVrf {
    IpamVrf {
        id: row.get("id"),
        name: row.get("name"),
        rd: none_if_empty(row.get("rd")),
        description: none_if_empty(row.get("description")),
        prefix_count: row.try_get("prefix_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn map_tag_row(row: &SqliteRow) -> IpamTag {
    IpamTag {
        id: row.get("id"),
        resource_type: row.get("resource_type"),
        resource_id: row.get("resource_id"),
        key: row.get("key"),
        value: row.get("value"),
        created_at: row.get("created_at"),
    }
}

// ========== Region Repo ==========

pub struct IpamRegionRepo;

impl IpamRegionRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRegion>> {
        let rows = sqlx::query(
            r#"SELECT r.*, COALESCE((SELECT COUNT(*) FROM ipam_locations WHERE region_id = r.id), 0) as location_count
               FROM ipam_regions r ORDER BY r.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_region_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamRegion>> {
        let row = sqlx::query(
            r#"SELECT r.*, COALESCE((SELECT COUNT(*) FROM ipam_locations WHERE region_id = r.id), 0) as location_count
               FROM ipam_regions r WHERE r.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_region_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_regions (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Region not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_regions SET name = ?, description = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or("")).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Region", id).into());
        }
        Self::get(pool, id).await?.context("Region not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_regions WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Region", id).into());
        }
        Ok(())
    }
}

// ========== Location Repo ==========

pub struct IpamLocationRepo;

impl IpamLocationRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamLocation>> {
        let rows = sqlx::query(
            r#"SELECT l.*, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_datacenters WHERE location_id = l.id), 0) as datacenter_count
               FROM ipam_locations l
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               ORDER BY r.name, l.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_location_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamLocation>> {
        let row = sqlx::query(
            r#"SELECT l.*, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_datacenters WHERE location_id = l.id), 0) as datacenter_count
               FROM ipam_locations l
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               WHERE l.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_location_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamLocationRequest) -> Result<IpamLocation> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_locations (id, name, description, region_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.region_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Location not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamLocationRequest) -> Result<IpamLocation> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_locations SET name = ?, description = ?, region_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.region_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Location", id).into());
        }
        Self::get(pool, id).await?.context("Location not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_locations WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Location", id).into());
        }
        Ok(())
    }
}

// ========== Datacenter Repo ==========

pub struct IpamDatacenterRepo;

impl IpamDatacenterRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamDatacenter>> {
        let rows = sqlx::query(
            r#"SELECT dc.*, l.name as location_name, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE datacenter_id = dc.id), 0) as prefix_count
               FROM ipam_datacenters dc
               LEFT JOIN ipam_locations l ON dc.location_id = l.id
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               ORDER BY r.name, l.name, dc.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_datacenter_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamDatacenter>> {
        let row = sqlx::query(
            r#"SELECT dc.*, l.name as location_name, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE datacenter_id = dc.id), 0) as prefix_count
               FROM ipam_datacenters dc
               LEFT JOIN ipam_locations l ON dc.location_id = l.id
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               WHERE dc.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_datacenter_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_datacenters (id, name, description, location_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.location_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Datacenter not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_datacenters SET name = ?, description = ?, location_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.location_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Datacenter", id).into());
        }
        Self::get(pool, id).await?.context("Datacenter not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_datacenters WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Datacenter", id).into());
        }
        Ok(())
    }
}

// ========== Role Repo ==========

pub struct IpamRoleRepo;

impl IpamRoleRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRole>> {
        let rows = sqlx::query("SELECT * FROM ipam_roles ORDER BY name")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_role_row).collect())
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRoleRequest) -> Result<IpamRole> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_roles (id, name, description, created_at) VALUES (?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(now)
            .execute(pool).await?;
        let row = sqlx::query("SELECT * FROM ipam_roles WHERE id = ?")
            .bind(&req.id).fetch_one(pool).await?;
        Ok(map_role_row(&row))
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_roles WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Role", id).into());
        }
        Ok(())
    }
}

// ========== Prefix Repo ==========

const SELECT_PREFIX: &str = r#"
    SELECT p.*,
           parent.prefix as parent_prefix,
           dc.name as datacenter_name,
           vrf.name as vrf_name,
           (SELECT GROUP_CONCAT(pr.role_id, ',') FROM ipam_prefix_roles pr WHERE pr.prefix_id = p.id) as role_ids_csv,
           (SELECT GROUP_CONCAT(r2.name, ',') FROM ipam_prefix_roles pr2 JOIN ipam_roles r2 ON pr2.role_id = r2.id WHERE pr2.prefix_id = p.id) as role_names_csv,
           COALESCE((SELECT COUNT(*) FROM ipam_prefixes c WHERE c.parent_id = p.id), 0) as child_prefix_count,
           COALESCE((SELECT COUNT(*) FROM ipam_ip_addresses ip WHERE ip.prefix_id = p.id), 0) as ip_address_count
    FROM ipam_prefixes p
    LEFT JOIN ipam_prefixes parent ON p.parent_id = parent.id
    LEFT JOIN ipam_datacenters dc ON p.datacenter_id = dc.id
    LEFT JOIN ipam_vrfs vrf ON p.vrf_id = vrf.id
"#;

pub struct IpamPrefixRepo;

impl IpamPrefixRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamPrefix>> {
        let rows = sqlx::query(&format!("{} ORDER BY p.network_int, p.prefix_length", SELECT_PREFIX))
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_prefix_row).collect())
    }

    pub async fn list_supernets(pool: &Pool<Sqlite>) -> Result<Vec<IpamPrefix>> {
        let rows = sqlx::query(&format!("{} WHERE p.is_supernet = 1 ORDER BY p.network_int", SELECT_PREFIX))
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_prefix_row).collect())
    }

    pub async fn list_by_parent(pool: &Pool<Sqlite>, parent_id: i64) -> Result<Vec<IpamPrefix>> {
        let rows = sqlx::query(&format!("{} WHERE p.parent_id = ? ORDER BY p.network_int", SELECT_PREFIX))
            .bind(parent_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_prefix_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<IpamPrefix>> {
        let row = sqlx::query(&format!("{} WHERE p.id = ?", SELECT_PREFIX))
            .bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_prefix_row))
    }

    pub async fn find_by_cidr(pool: &Pool<Sqlite>, cidr: &str, vrf_id: Option<&str>) -> Result<Option<IpamPrefix>> {
        let (network, broadcast, _) = utils::parse_cidr(cidr)
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        let row = sqlx::query(&format!("{} WHERE p.network_int = ? AND p.broadcast_int = ? AND COALESCE(p.vrf_id, '') = COALESCE(?, '')", SELECT_PREFIX))
            .bind(network as i64)
            .bind(broadcast as i64)
            .bind(vrf_id.unwrap_or(""))
            .fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_prefix_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamPrefixRequest) -> Result<IpamPrefix> {
        // Parse CIDR
        let (network, broadcast, prefix_len) = utils::parse_cidr(&req.prefix)
            .map_err(|e| anyhow::anyhow!("{}", e))?;

        // Check for duplicate CIDR within same VRF (NULL vrf_id = global)
        let existing: Option<SqliteRow> = sqlx::query(
            "SELECT id, prefix FROM ipam_prefixes WHERE network_int = ? AND broadcast_int = ? AND COALESCE(vrf_id, '') = COALESCE(?, '')"
        )
        .bind(network as i64)
        .bind(broadcast as i64)
        .bind(&req.vrf_id)
        .fetch_optional(pool).await?;

        if let Some(row) = existing {
            let existing_id: i64 = row.get("id");
            let existing_prefix: String = row.get("prefix");
            return Err(anyhow::anyhow!(
                "Duplicate prefix: {} already exists (id={})",
                existing_prefix, existing_id
            ));
        }

        // Validate parent containment
        if let Some(parent_id) = req.parent_id {
            let parent = Self::get(pool, parent_id).await?
                .ok_or_else(|| anyhow::anyhow!("Parent prefix not found: {}", parent_id))?;
            let parent_net = parent.network_int as u32;
            let parent_bcast = parent.broadcast_int as u32;
            if network < parent_net || broadcast > parent_bcast {
                return Err(anyhow::anyhow!(
                    "Prefix {} does not fit within parent {}",
                    req.prefix, parent.prefix
                ));
            }
        }

        let now = Utc::now();
        let canonical_prefix = utils::format_cidr(network, prefix_len);
        let result = sqlx::query(
            r#"INSERT INTO ipam_prefixes (prefix, network_int, broadcast_int, prefix_length,
               description, status, is_supernet, parent_id, datacenter_id, vlan_id, vrf_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#
        )
        .bind(&canonical_prefix)
        .bind(network as i64)
        .bind(broadcast as i64)
        .bind(prefix_len as i32)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.status)
        .bind(if req.is_supernet { 1i32 } else { 0i32 })
        .bind(req.parent_id)
        .bind(&req.datacenter_id)
        .bind(req.vlan_id)
        .bind(&req.vrf_id)
        .bind(now)
        .bind(now)
        .execute(pool).await?;

        let new_id = result.last_insert_rowid();

        // Insert role associations
        for role_id in &req.role_ids {
            if !role_id.is_empty() {
                sqlx::query("INSERT OR IGNORE INTO ipam_prefix_roles (prefix_id, role_id) VALUES (?, ?)")
                    .bind(new_id).bind(role_id)
                    .execute(pool).await?;
            }
        }

        Self::get(pool, new_id).await?.context("Prefix not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateIpamPrefixRequest) -> Result<IpamPrefix> {
        let (network, broadcast, prefix_len) = utils::parse_cidr(&req.prefix)
            .map_err(|e| anyhow::anyhow!("{}", e))?;

        // Check for duplicate CIDR within same VRF (exclude self)
        let existing: Option<SqliteRow> = sqlx::query(
            "SELECT id, prefix FROM ipam_prefixes WHERE network_int = ? AND broadcast_int = ? AND COALESCE(vrf_id, '') = COALESCE(?, '') AND id != ?"
        )
        .bind(network as i64)
        .bind(broadcast as i64)
        .bind(&req.vrf_id)
        .bind(id)
        .fetch_optional(pool).await?;

        if let Some(row) = existing {
            let existing_id: i64 = row.get("id");
            let existing_prefix: String = row.get("prefix");
            return Err(anyhow::anyhow!(
                "Duplicate prefix: {} already exists (id={})",
                existing_prefix, existing_id
            ));
        }

        let now = Utc::now();
        let canonical_prefix = utils::format_cidr(network, prefix_len);
        let result = sqlx::query(
            r#"UPDATE ipam_prefixes SET prefix = ?, network_int = ?, broadcast_int = ?, prefix_length = ?,
               description = ?, status = ?, is_supernet = ?, parent_id = ?, datacenter_id = ?,
               vlan_id = ?, vrf_id = ?, updated_at = ? WHERE id = ?"#
        )
        .bind(&canonical_prefix)
        .bind(network as i64)
        .bind(broadcast as i64)
        .bind(prefix_len as i32)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.status)
        .bind(if req.is_supernet { 1i32 } else { 0i32 })
        .bind(req.parent_id)
        .bind(&req.datacenter_id)
        .bind(req.vlan_id)
        .bind(&req.vrf_id)
        .bind(now)
        .bind(id)
        .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Prefix", &id.to_string()).into());
        }

        // Replace role associations
        sqlx::query("DELETE FROM ipam_prefix_roles WHERE prefix_id = ?")
            .bind(id).execute(pool).await?;
        for role_id in &req.role_ids {
            if !role_id.is_empty() {
                sqlx::query("INSERT OR IGNORE INTO ipam_prefix_roles (prefix_id, role_id) VALUES (?, ?)")
                    .bind(id).bind(role_id)
                    .execute(pool).await?;
            }
        }

        Self::get(pool, id).await?.context("Prefix not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_prefixes WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Prefix", &id.to_string()).into());
        }
        Ok(())
    }

    pub async fn next_available_prefix(
        pool: &Pool<Sqlite>,
        parent_id: i64,
        req: &NextAvailablePrefixRequest,
    ) -> Result<IpamPrefix> {
        let parent = Self::get(pool, parent_id).await?
            .ok_or_else(|| anyhow::anyhow!("Parent prefix not found: {}", parent_id))?;

        let parent_net = parent.network_int as u32;
        let parent_bcast = parent.broadcast_int as u32;

        // Load allocated children sorted by network_int
        let rows = sqlx::query(
            "SELECT network_int, broadcast_int FROM ipam_prefixes WHERE parent_id = ? ORDER BY network_int"
        ).bind(parent_id).fetch_all(pool).await?;

        let allocated: Vec<(u32, u32)> = rows.iter()
            .map(|r| (r.get::<i64, _>("network_int") as u32, r.get::<i64, _>("broadcast_int") as u32))
            .collect();

        let desired_len = req.prefix_length as u8;
        let (net, _bcast) = utils::next_available_prefix(parent_net, parent_bcast, desired_len, &allocated)
            .ok_or_else(|| anyhow::anyhow!(
                "No available /{} prefix within {}", req.prefix_length, parent.prefix
            ))?;

        let prefix_str = utils::format_cidr(net, desired_len);

        // Inherit VRF from parent
        let create_req = CreateIpamPrefixRequest {
            prefix: prefix_str,
            description: req.description.clone(),
            status: req.status.clone(),
            is_supernet: false,
            role_ids: vec![],
            parent_id: Some(parent_id),
            datacenter_id: req.datacenter_id.clone(),
            vlan_id: None,
            vrf_id: parent.vrf_id.clone(),
        };

        Self::create(pool, &create_req).await
    }
}

// ========== IP Address Repo ==========

const SELECT_IP_ADDRESS: &str = r#"
    SELECT ip.*,
           p.prefix as prefix_cidr,
           (SELECT GROUP_CONCAT(iar.role_id, ',') FROM ipam_ip_address_roles iar WHERE iar.ip_address_id = ip.id) as role_ids_csv,
           (SELECT GROUP_CONCAT(r2.name, ',') FROM ipam_ip_address_roles iar2 JOIN ipam_roles r2 ON iar2.role_id = r2.id WHERE iar2.ip_address_id = ip.id) as role_names_csv,
           d.hostname as device_hostname,
           vrf.name as vrf_name
    FROM ipam_ip_addresses ip
    LEFT JOIN ipam_prefixes p ON ip.prefix_id = p.id
    LEFT JOIN devices d ON ip.device_id = d.id
    LEFT JOIN ipam_vrfs vrf ON ip.vrf_id = vrf.id
"#;

pub struct IpamIpAddressRepo;

impl IpamIpAddressRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamIpAddress>> {
        let rows = sqlx::query(&format!("{} ORDER BY ip.address_int", SELECT_IP_ADDRESS))
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_ip_address_row).collect())
    }

    pub async fn list_by_prefix(pool: &Pool<Sqlite>, prefix_id: i64) -> Result<Vec<IpamIpAddress>> {
        let rows = sqlx::query(&format!("{} WHERE ip.prefix_id = ? ORDER BY ip.address_int", SELECT_IP_ADDRESS))
            .bind(prefix_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_ip_address_row).collect())
    }

    pub async fn list_by_role(pool: &Pool<Sqlite>, role_id: &str) -> Result<Vec<IpamIpAddress>> {
        let rows = sqlx::query(&format!(
            "{} WHERE ip.id IN (SELECT ip_address_id FROM ipam_ip_address_roles WHERE role_id = ?) ORDER BY ip.address_int",
            SELECT_IP_ADDRESS
        ))
            .bind(role_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_ip_address_row).collect())
    }

    pub async fn list_by_device(pool: &Pool<Sqlite>, device_id: &str) -> Result<Vec<IpamIpAddress>> {
        let rows = sqlx::query(&format!("{} WHERE ip.device_id = ? ORDER BY ip.address_int", SELECT_IP_ADDRESS))
            .bind(device_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_ip_address_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamIpAddress>> {
        let row = sqlx::query(&format!("{} WHERE ip.id = ?", SELECT_IP_ADDRESS))
            .bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_ip_address_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamIpAddressRequest) -> Result<IpamIpAddress> {
        // Strip /32 suffix if present
        let addr_str = req.address.trim_end_matches("/32");
        let addr_int = utils::parse_ipv4_to_u32(addr_str)
            .map_err(|e| anyhow::anyhow!("{}", e))?;

        // Validate IP is within prefix
        let prefix = IpamPrefixRepo::get(pool, req.prefix_id).await?
            .ok_or_else(|| anyhow::anyhow!("Prefix not found: {}", req.prefix_id))?;
        let pnet = prefix.network_int as u32;
        let pbcast = prefix.broadcast_int as u32;
        if addr_int < pnet || addr_int > pbcast {
            return Err(anyhow::anyhow!(
                "Address {} is outside prefix {} range", addr_str, prefix.prefix
            ));
        }

        let now = Utc::now();
        sqlx::query(
            r#"INSERT INTO ipam_ip_addresses (id, address, address_int, prefix_id, description,
               status, dns_name, device_id, interface_name, vrf_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#
        )
        .bind(&req.id)
        .bind(addr_str)
        .bind(addr_int as i64)
        .bind(&req.prefix_id)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.status)
        .bind(req.dns_name.as_deref().unwrap_or(""))
        .bind(&req.device_id)
        .bind(req.interface_name.as_deref().unwrap_or(""))
        .bind(&req.vrf_id)
        .bind(now)
        .bind(now)
        .execute(pool).await?;

        // Insert role associations
        for role_id in &req.role_ids {
            if !role_id.is_empty() {
                sqlx::query("INSERT OR IGNORE INTO ipam_ip_address_roles (ip_address_id, role_id) VALUES (?, ?)")
                    .bind(&req.id).bind(role_id)
                    .execute(pool).await?;
            }
        }

        Self::get(pool, &req.id).await?.context("IP address not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamIpAddressRequest) -> Result<IpamIpAddress> {
        let addr_str = req.address.trim_end_matches("/32");
        let addr_int = utils::parse_ipv4_to_u32(addr_str)
            .map_err(|e| anyhow::anyhow!("{}", e))?;
        let now = Utc::now();
        let result = sqlx::query(
            r#"UPDATE ipam_ip_addresses SET address = ?, address_int = ?, prefix_id = ?,
               description = ?, status = ?, dns_name = ?, device_id = ?,
               interface_name = ?, vrf_id = ?, updated_at = ? WHERE id = ?"#
        )
        .bind(addr_str)
        .bind(addr_int as i64)
        .bind(&req.prefix_id)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.status)
        .bind(req.dns_name.as_deref().unwrap_or(""))
        .bind(&req.device_id)
        .bind(req.interface_name.as_deref().unwrap_or(""))
        .bind(&req.vrf_id)
        .bind(now)
        .bind(id)
        .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("IP Address", id).into());
        }

        // Replace role associations
        sqlx::query("DELETE FROM ipam_ip_address_roles WHERE ip_address_id = ?")
            .bind(id).execute(pool).await?;
        for role_id in &req.role_ids {
            if !role_id.is_empty() {
                sqlx::query("INSERT OR IGNORE INTO ipam_ip_address_roles (ip_address_id, role_id) VALUES (?, ?)")
                    .bind(id).bind(role_id)
                    .execute(pool).await?;
            }
        }

        Self::get(pool, id).await?.context("IP address not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_ip_addresses WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("IP Address", id).into());
        }
        Ok(())
    }

    pub async fn next_available_ip(
        pool: &Pool<Sqlite>,
        prefix_id: i64,
        req: &NextAvailableIpRequest,
    ) -> Result<IpamIpAddress> {
        let prefix = IpamPrefixRepo::get(pool, prefix_id).await?
            .ok_or_else(|| anyhow::anyhow!("Prefix not found: {}", prefix_id))?;

        let pnet = prefix.network_int as u32;
        let pbcast = prefix.broadcast_int as u32;
        let plen = prefix.prefix_length as u8;

        let rows = sqlx::query(
            "SELECT address_int FROM ipam_ip_addresses WHERE prefix_id = ? ORDER BY address_int"
        ).bind(prefix_id).fetch_all(pool).await?;

        let allocated: Vec<u32> = rows.iter()
            .map(|r| r.get::<i64, _>("address_int") as u32)
            .collect();

        let addr_int = utils::next_available_ip(pnet, pbcast, plen, &allocated)
            .ok_or_else(|| anyhow::anyhow!("No available IP addresses in {}", prefix.prefix))?;

        let addr_str = utils::u32_to_ipv4(addr_int);
        let new_id = format!("ip-{}", addr_str.replace('.', "-"));

        // Inherit VRF from prefix
        let create_req = CreateIpamIpAddressRequest {
            id: new_id,
            address: addr_str,
            prefix_id,
            description: req.description.clone(),
            status: req.status.clone(),
            role_ids: req.role_ids.clone(),
            dns_name: req.dns_name.clone(),
            device_id: req.device_id.clone(),
            interface_name: req.interface_name.clone(),
            vrf_id: prefix.vrf_id.clone(),
        };

        Self::create(pool, &create_req).await
    }
}

// ========== VRF Repo ==========

pub struct IpamVrfRepo;

impl IpamVrfRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamVrf>> {
        let rows = sqlx::query(
            r#"SELECT v.*,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE vrf_id = v.id), 0) as prefix_count
               FROM ipam_vrfs v ORDER BY v.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_vrf_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamVrf>> {
        let row = sqlx::query(
            r#"SELECT v.*,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE vrf_id = v.id), 0) as prefix_count
               FROM ipam_vrfs v WHERE v.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_vrf_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamVrfRequest) -> Result<IpamVrf> {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO ipam_vrfs (id, name, rd, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.id).bind(&req.name)
        .bind(req.rd.as_deref().unwrap_or(""))
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(now).bind(now)
        .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("VRF not found after creation")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_vrfs WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("VRF", id).into());
        }
        Ok(())
    }
}

// ========== Tag Repo ==========

pub struct IpamTagRepo;

impl IpamTagRepo {
    pub async fn list_for_resource(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str) -> Result<Vec<IpamTag>> {
        let rows = sqlx::query(
            "SELECT * FROM ipam_tags WHERE resource_type = ? AND resource_id = ? ORDER BY key"
        ).bind(resource_type).bind(resource_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_tag_row).collect())
    }

    pub async fn set(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str, key: &str, value: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"INSERT INTO ipam_tags (resource_type, resource_id, key, value, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(resource_type, resource_id, key) DO UPDATE SET value = excluded.value"#
        )
        .bind(resource_type).bind(resource_id).bind(key).bind(value).bind(now)
        .execute(pool).await?;
        Ok(())
    }

    pub async fn delete(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM ipam_tags WHERE resource_type = ? AND resource_id = ? AND key = ?")
            .bind(resource_type).bind(resource_id).bind(key)
            .execute(pool).await?;
        Ok(())
    }

    pub async fn list_distinct_keys(pool: &Pool<Sqlite>) -> Result<Vec<String>> {
        let rows = sqlx::query("SELECT DISTINCT key FROM ipam_tags ORDER BY key")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(|r| r.get::<String, _>("key")).collect())
    }

    pub async fn delete_all_for_resource(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM ipam_tags WHERE resource_type = ? AND resource_id = ?")
            .bind(resource_type).bind(resource_id)
            .execute(pool).await?;
        Ok(())
    }
}
