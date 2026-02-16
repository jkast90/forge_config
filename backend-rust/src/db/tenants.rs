use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use super::row_helpers::none_if_empty;

fn map_tenant_row(row: &SqliteRow) -> Tenant {
    Tenant {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        status: row.get("status"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub struct TenantRepo;

impl TenantRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Tenant>> {
        let rows = sqlx::query("SELECT * FROM tenants ORDER BY name")
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_tenant_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Tenant>> {
        let row = sqlx::query("SELECT * FROM tenants WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_tenant_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateTenantRequest) -> Result<Tenant> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            INSERT INTO tenants (name, description, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.status)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id)
            .await?
            .context("Tenant not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateTenantRequest) -> Result<Tenant> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE tenants SET name = ?, description = ?, status = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Tenant", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("Tenant not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM tenants WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Tenant", &id.to_string()).into());
        }
        Ok(())
    }
}
