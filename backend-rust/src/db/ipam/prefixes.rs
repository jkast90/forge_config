use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use crate::utils;
use super::helpers::map_prefix_row;

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
            return Err(crate::db::NotFoundError::new("Prefix", &id.to_string()).into());
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
            return Err(crate::db::NotFoundError::new("Prefix", &id.to_string()).into());
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
