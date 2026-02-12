use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::map_vendor_row;

const SELECT_VENDOR: &str = r#"
    SELECT v.id, v.name, v.backup_command, v.deploy_command, v.ssh_port, v.ssh_user, v.ssh_pass,
           v.mac_prefixes, v.vendor_class, v.default_template,
           v.created_at, v.updated_at,
           COALESCE(COUNT(d.mac), 0) as device_count
    FROM vendors v
    LEFT JOIN devices d ON d.vendor = v.id
"#;

/// Vendor database operations
pub struct VendorRepo;

impl VendorRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Vendor>> {
        let rows = sqlx::query(&format!("{} GROUP BY v.id ORDER BY v.name", SELECT_VENDOR))
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_vendor_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<Vendor>> {
        let row = sqlx::query(&format!("{} WHERE v.id = ? GROUP BY v.id", SELECT_VENDOR))
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_vendor_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateVendorRequest) -> Result<Vendor> {
        let now = Utc::now();
        let mac_prefixes_json = serde_json::to_string(&req.mac_prefixes)?;

        sqlx::query(
            r#"
            INSERT INTO vendors (id, name, backup_command, deploy_command, ssh_port, ssh_user, ssh_pass,
                                 mac_prefixes, vendor_class, default_template, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.id)
        .bind(&req.name)
        .bind(&req.backup_command)
        .bind(&req.deploy_command)
        .bind(req.ssh_port)
        .bind(&req.ssh_user)
        .bind(&req.ssh_pass)
        .bind(&mac_prefixes_json)
        .bind(&req.vendor_class)
        .bind(&req.default_template)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, &req.id)
            .await?
            .context("Vendor not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateVendorRequest) -> Result<Vendor> {
        let now = Utc::now();
        let mac_prefixes_json = serde_json::to_string(&req.mac_prefixes)?;

        let result = sqlx::query(
            r#"
            UPDATE vendors SET name = ?, backup_command = ?, deploy_command = ?, ssh_port = ?, ssh_user = ?, ssh_pass = ?,
                              mac_prefixes = ?, vendor_class = ?, default_template = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.name)
        .bind(&req.backup_command)
        .bind(&req.deploy_command)
        .bind(req.ssh_port)
        .bind(&req.ssh_user)
        .bind(&req.ssh_pass)
        .bind(&mac_prefixes_json)
        .bind(&req.vendor_class)
        .bind(&req.default_template)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Vendor", id).into());
        }

        Self::get(pool, id)
            .await?
            .context("Vendor not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM vendors WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Vendor", id).into());
        }
        Ok(())
    }
}
