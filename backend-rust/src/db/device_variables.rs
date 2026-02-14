use anyhow::Result;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::DeviceVariable;

fn map_row(row: &SqliteRow) -> DeviceVariable {
    DeviceVariable {
        id: row.get("id"),
        device_id: row.get("device_id"),
        key: row.get("key"),
        value: row.get("value"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub struct DeviceVariableRepo;

impl DeviceVariableRepo {
    /// List all variables for a device
    pub async fn list_by_device(pool: &Pool<Sqlite>, device_id: &str) -> Result<Vec<DeviceVariable>> {
        let rows = sqlx::query(
            "SELECT id, device_id, key, value, created_at, updated_at FROM device_variables WHERE device_id = ? ORDER BY key",
        )
        .bind(device_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_row).collect())
    }

    /// List all variables across devices for a given key
    pub async fn list_by_key(pool: &Pool<Sqlite>, key: &str) -> Result<Vec<DeviceVariable>> {
        let rows = sqlx::query(
            "SELECT id, device_id, key, value, created_at, updated_at FROM device_variables WHERE key = ? ORDER BY device_id",
        )
        .bind(key)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_row).collect())
    }

    /// Get a single variable
    pub async fn get(pool: &Pool<Sqlite>, device_id: &str, key: &str) -> Result<Option<DeviceVariable>> {
        let row = sqlx::query(
            "SELECT id, device_id, key, value, created_at, updated_at FROM device_variables WHERE device_id = ? AND key = ?",
        )
        .bind(device_id)
        .bind(key)
        .fetch_optional(pool)
        .await?;

        Ok(row.as_ref().map(map_row))
    }

    /// Upsert a single variable
    pub async fn set(pool: &Pool<Sqlite>, device_id: &str, key: &str, value: &str) -> Result<()> {
        let now = chrono::Utc::now();
        sqlx::query(
            r#"
            INSERT INTO device_variables (device_id, key, value, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(device_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            "#,
        )
        .bind(device_id)
        .bind(key)
        .bind(value)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Ok(())
    }

    /// Delete a single variable
    pub async fn delete(pool: &Pool<Sqlite>, device_id: &str, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM device_variables WHERE device_id = ? AND key = ?")
            .bind(device_id)
            .bind(key)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// Delete all variables for a device
    pub async fn delete_all_for_device(pool: &Pool<Sqlite>, device_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM device_variables WHERE device_id = ?")
            .bind(device_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    /// List all distinct keys across all devices, with count of devices using each
    pub async fn list_keys(pool: &Pool<Sqlite>) -> Result<Vec<(String, i64)>> {
        let rows = sqlx::query(
            "SELECT key, COUNT(*) as count FROM device_variables GROUP BY key ORDER BY key",
        )
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(|r| (r.get::<String, _>("key"), r.get::<i64, _>("count"))).collect())
    }

    /// Bulk upsert variables
    pub async fn bulk_set(pool: &Pool<Sqlite>, entries: &[(String, String, String)]) -> Result<()> {
        let now = chrono::Utc::now();
        for (device_id, key, value) in entries {
            sqlx::query(
                r#"
                INSERT INTO device_variables (device_id, key, value, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(device_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
                "#,
            )
            .bind(device_id)
            .bind(key)
            .bind(value)
            .bind(now)
            .bind(now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    /// Delete a key from all devices
    pub async fn delete_key(pool: &Pool<Sqlite>, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM device_variables WHERE key = ?")
            .bind(key)
            .execute(pool)
            .await?;
        Ok(())
    }
}
