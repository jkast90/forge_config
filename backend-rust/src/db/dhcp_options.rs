use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::map_dhcp_option_row;

const SELECT_DHCP_OPTION: &str = r#"
    SELECT id, option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at
    FROM dhcp_options
"#;

/// DHCP option database operations
pub struct DhcpOptionRepo;

impl DhcpOptionRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<DhcpOption>> {
        let rows = sqlx::query(&format!("{} ORDER BY option_number, vendor_id", SELECT_DHCP_OPTION))
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_dhcp_option_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<DhcpOption>> {
        let row = sqlx::query(&format!("{} WHERE id = ?", SELECT_DHCP_OPTION))
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_dhcp_option_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        let now = Utc::now();
        sqlx::query(
            r#"
            INSERT INTO dhcp_options (id, option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.id)
        .bind(req.option_number)
        .bind(&req.name)
        .bind(&req.value)
        .bind(&req.option_type)
        .bind(&req.vendor_id.clone().unwrap_or_default())
        .bind(&req.description.clone().unwrap_or_default())
        .bind(req.enabled as i32)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, &req.id)
            .await?
            .context("DHCP option not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE dhcp_options SET option_number = ?, name = ?, value = ?, type = ?,
                                   vendor_id = ?, description = ?, enabled = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(req.option_number)
        .bind(&req.name)
        .bind(&req.value)
        .bind(&req.option_type)
        .bind(&req.vendor_id.clone().unwrap_or_default())
        .bind(&req.description.clone().unwrap_or_default())
        .bind(req.enabled as i32)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("DHCP option", id).into());
        }

        Self::get(pool, id)
            .await?
            .context("DHCP option not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM dhcp_options WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("DHCP option", id).into());
        }
        Ok(())
    }
}
