use anyhow::Result;
use sqlx::{Pool, Row, Sqlite};

use crate::models::*;

use super::row_helpers::map_backup_row;

/// Settings database operations
pub struct SettingsRepo;

impl SettingsRepo {
    pub async fn get(pool: &Pool<Sqlite>) -> Result<Settings> {
        let row: (String,) = sqlx::query_as("SELECT data FROM settings WHERE id = 1")
            .fetch_one(pool)
            .await?;
        Ok(serde_json::from_str(&row.0)?)
    }

    pub async fn update(pool: &Pool<Sqlite>, settings: &Settings) -> Result<()> {
        let data = serde_json::to_string(settings)?;
        sqlx::query("UPDATE settings SET data = ? WHERE id = 1")
            .bind(&data)
            .execute(pool)
            .await?;
        Ok(())
    }
}

/// Backup database operations
pub struct BackupRepo;

impl BackupRepo {
    pub async fn create(pool: &Pool<Sqlite>, device_mac: &str, filename: &str, size: i64) -> Result<Backup> {
        let now = chrono::Utc::now();
        let result = sqlx::query(
            "INSERT INTO backups (device_mac, filename, size, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(device_mac)
        .bind(filename)
        .bind(size)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(Backup {
            id: result.last_insert_rowid(),
            device_mac: device_mac.to_string(),
            filename: filename.to_string(),
            size,
            created_at: now,
        })
    }

    pub async fn list(pool: &Pool<Sqlite>, mac: &str) -> Result<Vec<Backup>> {
        let rows = sqlx::query(
            r#"
            SELECT id, device_mac, filename, size, created_at
            FROM backups WHERE device_mac = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(mac)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_backup_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Backup>> {
        let row = sqlx::query(
            "SELECT id, device_mac, filename, size, created_at FROM backups WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(row.as_ref().map(map_backup_row))
    }
}

/// NetBox config database operations
pub struct NetBoxConfigRepo;

impl NetBoxConfigRepo {
    pub async fn get(pool: &Pool<Sqlite>) -> Result<NetBoxConfig> {
        let row = sqlx::query(
            "SELECT url, token, site_id, role_id, sync_enabled FROM netbox_config WHERE id = 1",
        )
        .fetch_optional(pool)
        .await?;

        Ok(row
            .map(|row| {
                let sync_enabled: i32 = row.get("sync_enabled");
                NetBoxConfig {
                    url: row.get("url"),
                    token: row.get("token"),
                    site_id: row.get("site_id"),
                    role_id: row.get("role_id"),
                    sync_enabled: sync_enabled == 1,
                }
            })
            .unwrap_or_default())
    }

    pub async fn save(pool: &Pool<Sqlite>, config: &NetBoxConfig) -> Result<()> {
        let result = sqlx::query(
            r#"
            UPDATE netbox_config
            SET url = ?, token = ?, site_id = ?, role_id = ?, sync_enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            "#,
        )
        .bind(&config.url)
        .bind(&config.token)
        .bind(config.site_id)
        .bind(config.role_id)
        .bind(config.sync_enabled as i32)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            sqlx::query(
                "INSERT INTO netbox_config (id, url, token, site_id, role_id, sync_enabled) VALUES (1, ?, ?, ?, ?, ?)",
            )
            .bind(&config.url)
            .bind(&config.token)
            .bind(config.site_id)
            .bind(config.role_id)
            .bind(config.sync_enabled as i32)
            .execute(pool)
            .await?;
        }
        Ok(())
    }
}
