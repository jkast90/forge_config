use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::map_device_row;

const SELECT_DEVICE: &str = r#"
    SELECT id, mac, ip, hostname, vendor, model, serial_number, config_template,
           ssh_user, ssh_pass, topology_id, topology_role,
           hall_id, row_id, rack_id, rack_position,
           status, device_type, last_seen, last_backup, last_error,
           created_at, updated_at
    FROM devices
"#;

/// Device database operations
pub struct DeviceRepo;

impl DeviceRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Device>> {
        let rows = sqlx::query(&format!("{} ORDER BY hostname", SELECT_DEVICE))
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_device_row).collect())
    }

    pub async fn list_paged(pool: &Pool<Sqlite>, limit: i32, offset: i32) -> Result<Vec<Device>> {
        let rows = sqlx::query(&format!("{} ORDER BY hostname LIMIT ? OFFSET ?", SELECT_DEVICE))
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_device_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Device>> {
        let row = sqlx::query(&format!("{} WHERE id = ?", SELECT_DEVICE))
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_device_row))
    }

    pub async fn get_by_mac(pool: &Pool<Sqlite>, mac: &str) -> Result<Option<Device>> {
        let row = sqlx::query(&format!("{} WHERE mac = ?", SELECT_DEVICE))
            .bind(mac)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_device_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateDeviceRequest) -> Result<Device> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            INSERT INTO devices (mac, ip, hostname, vendor, model, serial_number, config_template,
                                ssh_user, ssh_pass, topology_id, topology_role,
                                hall_id, row_id, rack_id, rack_position,
                                device_type, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?)
            "#,
        )
        .bind(&req.mac)
        .bind(&req.ip)
        .bind(&req.hostname)
        .bind(&req.vendor.clone().unwrap_or_default())
        .bind(&req.model.clone().unwrap_or_default())
        .bind(&req.serial_number.clone().unwrap_or_default())
        .bind(&req.config_template)
        .bind(&req.ssh_user.clone().unwrap_or_default())
        .bind(&req.ssh_pass.clone().unwrap_or_default())
        .bind(req.topology_id)
        .bind(&req.topology_role.clone().unwrap_or_default())
        .bind(req.hall_id)
        .bind(req.row_id)
        .bind(req.rack_id)
        .bind(req.rack_position.unwrap_or(0))
        .bind(&req.device_type.clone().unwrap_or_else(|| "internal".to_string()))
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();

        Self::get(pool, new_id)
            .await?
            .context("Device not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &UpdateDeviceRequest) -> Result<Device> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE devices SET ip = ?, hostname = ?, vendor = ?, model = ?, serial_number = ?,
                              config_template = ?, ssh_user = ?, ssh_pass = ?,
                              topology_id = ?, topology_role = ?,
                              hall_id = ?, row_id = ?, rack_id = ?, rack_position = ?,
                              device_type = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.ip)
        .bind(&req.hostname)
        .bind(&req.vendor.clone().unwrap_or_default())
        .bind(&req.model.clone().unwrap_or_default())
        .bind(&req.serial_number.clone().unwrap_or_default())
        .bind(&req.config_template)
        .bind(&req.ssh_user.clone().unwrap_or_default())
        .bind(&req.ssh_pass.clone().unwrap_or_default())
        .bind(req.topology_id)
        .bind(&req.topology_role.clone().unwrap_or_default())
        .bind(req.hall_id)
        .bind(req.row_id)
        .bind(req.rack_id)
        .bind(req.rack_position.unwrap_or(0))
        .bind(&req.device_type.clone().unwrap_or_else(|| "internal".to_string()))
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("Device not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM devices WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device", &id.to_string()).into());
        }
        Ok(())
    }

    pub async fn update_status(pool: &Pool<Sqlite>, id: i64, status: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET status = ?, last_seen = ?, updated_at = ? WHERE id = ?")
            .bind(status)
            .bind(now)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_backup_time(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET last_backup = ?, updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn delete_by_topology(pool: &Pool<Sqlite>, topology_id: i64) -> Result<u64> {
        // Also clean up device variables for these devices
        let device_ids: Vec<i64> = sqlx::query_scalar(
            "SELECT id FROM devices WHERE topology_id = ?",
        )
        .bind(topology_id)
        .fetch_all(pool)
        .await?;

        for id in &device_ids {
            sqlx::query("DELETE FROM device_variables WHERE device_id = ?")
                .bind(id)
                .execute(pool)
                .await?;
        }

        let result = sqlx::query("DELETE FROM devices WHERE topology_id = ?")
            .bind(topology_id)
            .execute(pool)
            .await?;

        Ok(result.rows_affected())
    }

    pub async fn update_error(pool: &Pool<Sqlite>, id: i64, error_msg: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET last_error = ?, updated_at = ? WHERE id = ?")
            .bind(error_msg)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
