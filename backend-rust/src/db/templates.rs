use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;

use super::row_helpers::map_template_row;

const SELECT_TEMPLATE: &str = r#"
    SELECT t.id, t.name, t.description, t.vendor_id, t.content, t.created_at, t.updated_at,
           COALESCE(COUNT(d.mac), 0) as device_count
    FROM templates t
    LEFT JOIN devices d ON d.config_template = CAST(t.id AS TEXT)
"#;

/// Template database operations
pub struct TemplateRepo;

impl TemplateRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Template>> {
        let rows = sqlx::query(&format!("{} GROUP BY t.id ORDER BY t.name", SELECT_TEMPLATE))
            .fetch_all(pool)
            .await?;

        Ok(rows.iter().map(map_template_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Template>> {
        let row = sqlx::query(&format!("{} WHERE t.id = ? GROUP BY t.id", SELECT_TEMPLATE))
            .bind(id)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_template_row))
    }

    pub async fn get_by_name(pool: &Pool<Sqlite>, name: &str) -> Result<Option<Template>> {
        let row = sqlx::query(&format!("{} WHERE t.name = ? GROUP BY t.id", SELECT_TEMPLATE))
            .bind(name)
            .fetch_optional(pool)
            .await?;

        Ok(row.as_ref().map(map_template_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateTemplateRequest) -> Result<Template> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            INSERT INTO templates (name, description, vendor_id, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.name)
        .bind(&req.description.clone().unwrap_or_default())
        .bind(&req.vendor_id)
        .bind(&req.content)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id)
            .await?
            .context("Template not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateTemplateRequest) -> Result<Template> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE templates SET name = ?, description = ?, vendor_id = ?, content = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.name)
        .bind(&req.description.clone().unwrap_or_default())
        .bind(&req.vendor_id)
        .bind(&req.content)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Template", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("Template not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM templates WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Template", &id.to_string()).into());
        }
        Ok(())
    }
}
