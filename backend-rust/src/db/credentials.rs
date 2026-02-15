use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use super::row_helpers::none_if_empty;

// ========== Row Mapper ==========

fn map_credential_row(row: &SqliteRow) -> Credential {
    Credential {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        cred_type: row.get("cred_type"),
        username: row.get("username"),
        password: row.get("password"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

// ========== Credential Repo ==========

pub struct CredentialRepo;

impl CredentialRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Credential>> {
        let rows = sqlx::query("SELECT * FROM credentials ORDER BY name")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_credential_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<Credential>> {
        let row = sqlx::query("SELECT * FROM credentials WHERE id = ?")
            .bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_credential_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateCredentialRequest) -> Result<Credential> {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO credentials (id, name, description, cred_type, username, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.cred_type)
        .bind(&req.username)
        .bind(&req.password)
        .bind(now)
        .bind(now)
        .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Credential not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateCredentialRequest) -> Result<Credential> {
        let now = Utc::now();
        let result = sqlx::query(
            "UPDATE credentials SET name = ?, description = ?, cred_type = ?, username = ?, password = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.cred_type)
        .bind(&req.username)
        .bind(&req.password)
        .bind(now)
        .bind(id)
        .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Credential", id).into());
        }
        Self::get(pool, id).await?.context("Credential not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM credentials WHERE id = ?")
            .bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Credential", id).into());
        }
        Ok(())
    }
}
