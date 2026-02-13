use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;

fn map_vendor_action_row(row: &SqliteRow) -> VendorAction {
    VendorAction {
        id: row.get("id"),
        vendor_id: row.get("vendor_id"),
        label: row.get("label"),
        command: row.get("command"),
        sort_order: row.get("sort_order"),
        created_at: row.get("created_at"),
    }
}

const SELECT_VENDOR_ACTION: &str = r#"
    SELECT id, vendor_id, label, command, sort_order, created_at
    FROM vendor_actions
"#;

pub struct VendorActionRepo;

impl VendorActionRepo {
    pub async fn list_all(pool: &Pool<Sqlite>) -> Result<Vec<VendorAction>> {
        let rows = sqlx::query(&format!("{} ORDER BY vendor_id, sort_order, label", SELECT_VENDOR_ACTION))
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_vendor_action_row).collect())
    }

    pub async fn list_by_vendor(pool: &Pool<Sqlite>, vendor_id: &str) -> Result<Vec<VendorAction>> {
        let rows = sqlx::query(&format!("{} WHERE vendor_id = ? ORDER BY sort_order, label", SELECT_VENDOR_ACTION))
            .bind(vendor_id)
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_vendor_action_row).collect())
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        let now = Utc::now();
        sqlx::query(
            r#"
            INSERT INTO vendor_actions (id, vendor_id, label, command, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.id)
        .bind(&req.vendor_id)
        .bind(&req.label)
        .bind(&req.command)
        .bind(req.sort_order)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, &req.id)
            .await?
            .context("Vendor action not found after creation")
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<VendorAction>> {
        let row = sqlx::query(&format!("{} WHERE id = ?", SELECT_VENDOR_ACTION))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_vendor_action_row))
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        let result = sqlx::query(
            r#"
            UPDATE vendor_actions SET vendor_id = ?, label = ?, command = ?, sort_order = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.vendor_id)
        .bind(&req.label)
        .bind(&req.command)
        .bind(req.sort_order)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("vendor action", id).into());
        }

        Self::get(pool, id)
            .await?
            .context("Vendor action not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM vendor_actions WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("vendor action", id).into());
        }
        Ok(())
    }
}
