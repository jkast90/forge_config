use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite};

use crate::models::*;
use crate::utils;
use super::helpers::map_ip_address_row;
use super::prefixes::IpamPrefixRepo;

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

    pub async fn list_by_device(pool: &Pool<Sqlite>, device_id: i64) -> Result<Vec<IpamIpAddress>> {
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
            return Err(crate::db::NotFoundError::new("IP Address", id).into());
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
            return Err(crate::db::NotFoundError::new("IP Address", id).into());
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
