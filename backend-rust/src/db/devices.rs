use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::map_device_row;

const SELECT_DEVICE: &str = r#"
    SELECT mac, ip, hostname, vendor, model, serial_number, config_template,
           ssh_user, ssh_pass, status, last_seen, last_backup, last_error,
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

    pub async fn get(pool: &Pool<Sqlite>, mac: &str) -> Result<Option<Device>> {
        let row = sqlx::query(&format!("{} WHERE mac = ?", SELECT_DEVICE))
            .bind(mac)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_device_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateDeviceRequest) -> Result<Device> {
        let now = Utc::now();
        sqlx::query(
            r#"
            INSERT INTO devices (mac, ip, hostname, vendor, model, serial_number, config_template,
                                ssh_user, ssh_pass, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?)
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
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, &req.mac)
            .await?
            .context("Device not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, mac: &str, req: &UpdateDeviceRequest) -> Result<Device> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE devices SET ip = ?, hostname = ?, vendor = ?, model = ?, serial_number = ?,
                              config_template = ?, ssh_user = ?, ssh_pass = ?, updated_at = ?
            WHERE mac = ?
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
        .bind(now)
        .bind(mac)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device", mac).into());
        }

        Self::get(pool, mac)
            .await?
            .context("Device not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, mac: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM devices WHERE mac = ?")
            .bind(mac)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device", mac).into());
        }
        Ok(())
    }

    pub async fn update_status(pool: &Pool<Sqlite>, mac: &str, status: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET status = ?, last_seen = ?, updated_at = ? WHERE mac = ?")
            .bind(status)
            .bind(now)
            .bind(now)
            .bind(mac)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_backup_time(pool: &Pool<Sqlite>, mac: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET last_backup = ?, updated_at = ? WHERE mac = ?")
            .bind(now)
            .bind(now)
            .bind(mac)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_error(pool: &Pool<Sqlite>, mac: &str, error_msg: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE devices SET last_error = ?, updated_at = ? WHERE mac = ?")
            .bind(error_msg)
            .bind(now)
            .bind(mac)
            .execute(pool)
            .await?;
        Ok(())
    }
}
