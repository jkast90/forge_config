use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;

use super::row_helpers::none_if_empty;

const SELECT_DEVICE_MODEL: &str = r#"
    SELECT dm.id, dm.vendor_id, dm.model, dm.display_name, dm.rack_units, dm.layout,
           dm.created_at, dm.updated_at,
           COALESCE(COUNT(d.id), 0) as device_count
    FROM device_models dm
    LEFT JOIN devices d ON d.model = dm.model AND d.vendor = dm.vendor_id
"#;

fn map_device_model_row(row: &SqliteRow) -> DeviceModel {
    DeviceModel {
        id: row.get("id"),
        vendor_id: row.get("vendor_id"),
        model: row.get("model"),
        display_name: row.get("display_name"),
        rack_units: row.get("rack_units"),
        layout: row.get("layout"),
        device_count: Some(row.get("device_count")),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub struct DeviceModelRepo;

impl DeviceModelRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<DeviceModel>> {
        let rows = sqlx::query(&format!(
            "{} GROUP BY dm.id ORDER BY dm.vendor_id, dm.model",
            SELECT_DEVICE_MODEL
        ))
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_device_model_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<DeviceModel>> {
        let row = sqlx::query(&format!(
            "{} WHERE dm.id = ? GROUP BY dm.id",
            SELECT_DEVICE_MODEL
        ))
        .bind(id)
        .fetch_optional(pool)
        .await?;

        Ok(row.as_ref().map(map_device_model_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        let now = Utc::now();

        sqlx::query(
            r#"
            INSERT INTO device_models (id, vendor_id, model, display_name, rack_units, layout, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.id)
        .bind(&req.vendor_id)
        .bind(&req.model)
        .bind(&req.display_name)
        .bind(req.rack_units)
        .bind(&req.layout)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, &req.id)
            .await?
            .context("Device model not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        let now = Utc::now();

        let result = sqlx::query(
            r#"
            UPDATE device_models SET vendor_id = ?, model = ?, display_name = ?, rack_units = ?,
                                     layout = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.vendor_id)
        .bind(&req.model)
        .bind(&req.display_name)
        .bind(req.rack_units)
        .bind(&req.layout)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device model", id).into());
        }

        Self::get(pool, id)
            .await?
            .context("Device model not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM device_models WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Device model", id).into());
        }
        Ok(())
    }
}
