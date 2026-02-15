use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use super::row_helpers::none_if_empty;

// ========== Row Mapper ==========

fn map_output_parser_row(row: &SqliteRow) -> OutputParser {
    OutputParser {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        pattern: row.get("pattern"),
        extract_names: row.get("extract_names"),
        enabled: row.get::<i32, _>("enabled") == 1,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

// ========== Output Parser Repo ==========

pub struct OutputParserRepo;

impl OutputParserRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<OutputParser>> {
        let rows = sqlx::query("SELECT * FROM output_parsers ORDER BY name")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_output_parser_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<OutputParser>> {
        let row = sqlx::query("SELECT * FROM output_parsers WHERE id = ?")
            .bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_output_parser_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateOutputParserRequest) -> Result<OutputParser> {
        let now = Utc::now();
        let result = sqlx::query(
            "INSERT INTO output_parsers (name, description, pattern, extract_names, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.pattern)
        .bind(&req.extract_names)
        .bind(if req.enabled { 1i32 } else { 0i32 })
        .bind(now)
        .bind(now)
        .execute(pool).await?;
        let id = result.last_insert_rowid();
        Self::get(pool, id).await?.context("OutputParser not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateOutputParserRequest) -> Result<OutputParser> {
        let now = Utc::now();
        let result = sqlx::query(
            "UPDATE output_parsers SET name = ?, description = ?, pattern = ?, extract_names = ?, enabled = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.pattern)
        .bind(&req.extract_names)
        .bind(if req.enabled { 1i32 } else { 0i32 })
        .bind(now)
        .bind(id)
        .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("OutputParser", &id.to_string()).into());
        }
        Self::get(pool, id).await?.context("OutputParser not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM output_parsers WHERE id = ?")
            .bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("OutputParser", &id.to_string()).into());
        }
        Ok(())
    }
}
