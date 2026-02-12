use anyhow::Result;
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::{map_discovery_log_row, map_discovered_device_row};

/// Discovery log and discovered device database operations
pub struct DiscoveryRepo;

impl DiscoveryRepo {
    pub async fn create_log(pool: &Pool<Sqlite>, req: &CreateDiscoveryLogRequest) -> Result<DiscoveryLog> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            INSERT INTO discovery_logs (event_type, mac, ip, hostname, vendor, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.event_type)
        .bind(&req.mac)
        .bind(&req.ip)
        .bind(&req.hostname.clone().unwrap_or_default())
        .bind(&req.vendor.clone().unwrap_or_default())
        .bind(&req.message.clone().unwrap_or_default())
        .bind(now)
        .execute(pool)
        .await?;

        Ok(DiscoveryLog {
            id: result.last_insert_rowid(),
            event_type: req.event_type.clone(),
            mac: req.mac.clone(),
            ip: req.ip.clone(),
            hostname: req.hostname.clone(),
            vendor: req.vendor.clone(),
            message: req.message.clone(),
            created_at: now,
        })
    }

    pub async fn list_logs(pool: &Pool<Sqlite>, limit: i32) -> Result<Vec<DiscoveryLog>> {
        let limit = if limit <= 0 { 100 } else { limit };
        let rows = sqlx::query(
            r#"
            SELECT id, event_type, mac, ip, hostname, vendor, message, created_at
            FROM discovery_logs
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_discovery_log_row).collect())
    }

    pub async fn clear_logs(pool: &Pool<Sqlite>) -> Result<()> {
        sqlx::query("DELETE FROM discovery_logs")
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn upsert_discovered_device(pool: &Pool<Sqlite>, lease: &Lease) -> Result<()> {
        let now = Utc::now();
        let expires_at = chrono::DateTime::from_timestamp(lease.expiry_time, 0);
        sqlx::query(
            r#"
            INSERT INTO discovered_devices (mac, ip, hostname, vendor, model, serial_number,
                vendor_class, user_class, dhcp_client_id, requested_options,
                relay_address, circuit_id, remote_id, subscriber_id,
                first_seen, last_seen, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mac) DO UPDATE SET
                ip = excluded.ip,
                hostname = excluded.hostname,
                vendor = CASE WHEN excluded.vendor != '' THEN excluded.vendor ELSE discovered_devices.vendor END,
                model = CASE WHEN excluded.model != '' THEN excluded.model ELSE discovered_devices.model END,
                serial_number = CASE WHEN excluded.serial_number != '' THEN excluded.serial_number ELSE discovered_devices.serial_number END,
                vendor_class = CASE WHEN excluded.vendor_class != '' THEN excluded.vendor_class ELSE discovered_devices.vendor_class END,
                user_class = CASE WHEN excluded.user_class != '' THEN excluded.user_class ELSE discovered_devices.user_class END,
                dhcp_client_id = CASE WHEN excluded.dhcp_client_id != '' THEN excluded.dhcp_client_id ELSE discovered_devices.dhcp_client_id END,
                requested_options = CASE WHEN excluded.requested_options != '' THEN excluded.requested_options ELSE discovered_devices.requested_options END,
                relay_address = CASE WHEN excluded.relay_address != '' THEN excluded.relay_address ELSE discovered_devices.relay_address END,
                circuit_id = CASE WHEN excluded.circuit_id != '' THEN excluded.circuit_id ELSE discovered_devices.circuit_id END,
                remote_id = CASE WHEN excluded.remote_id != '' THEN excluded.remote_id ELSE discovered_devices.remote_id END,
                subscriber_id = CASE WHEN excluded.subscriber_id != '' THEN excluded.subscriber_id ELSE discovered_devices.subscriber_id END,
                last_seen = excluded.last_seen,
                expires_at = excluded.expires_at
            "#,
        )
        .bind(&lease.mac)
        .bind(&lease.ip)
        .bind(&lease.hostname)
        .bind(lease.vendor.as_deref().unwrap_or(""))
        .bind(lease.model.as_deref().unwrap_or(""))
        .bind(lease.serial_number.as_deref().unwrap_or(""))
        .bind(lease.vendor_class.as_deref().unwrap_or(""))
        .bind(lease.user_class.as_deref().unwrap_or(""))
        .bind(lease.dhcp_client_id.as_deref().unwrap_or(""))
        .bind(lease.requested_options.as_deref().unwrap_or(""))
        .bind(lease.relay_address.as_deref().unwrap_or(""))
        .bind(lease.circuit_id.as_deref().unwrap_or(""))
        .bind(lease.remote_id.as_deref().unwrap_or(""))
        .bind(lease.subscriber_id.as_deref().unwrap_or(""))
        .bind(now)
        .bind(now)
        .bind(expires_at)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn list_discovered_devices(pool: &Pool<Sqlite>) -> Result<Vec<Lease>> {
        let cutoff = Utc::now() - chrono::Duration::minutes(5);
        let rows = sqlx::query(
            r#"
            SELECT dd.mac, dd.ip, dd.hostname, dd.vendor, dd.model, dd.serial_number,
                   dd.vendor_class, dd.user_class, dd.dhcp_client_id, dd.requested_options,
                   dd.relay_address, dd.circuit_id, dd.remote_id, dd.subscriber_id, dd.expires_at
            FROM discovered_devices dd
            LEFT JOIN devices d ON LOWER(d.mac) = LOWER(dd.mac)
            WHERE d.mac IS NULL AND dd.last_seen >= ?
            ORDER BY dd.last_seen DESC
            "#,
        )
        .bind(cutoff)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_discovered_device_row).collect())
    }

    /// Delete discovered devices not seen in the last 5 minutes
    pub async fn cleanup_stale_discovered_devices(pool: &Pool<Sqlite>) -> Result<u64> {
        let cutoff = Utc::now() - chrono::Duration::minutes(5);
        let result = sqlx::query("DELETE FROM discovered_devices WHERE last_seen < ?")
            .bind(cutoff)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    pub async fn delete_discovered_device(pool: &Pool<Sqlite>, mac: &str) -> Result<()> {
        sqlx::query("DELETE FROM discovered_devices WHERE LOWER(mac) = LOWER(?)")
            .bind(mac)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn clear_discovered_devices(pool: &Pool<Sqlite>) -> Result<()> {
        sqlx::query("DELETE FROM discovered_devices")
            .execute(pool)
            .await?;
        Ok(())
    }
}
