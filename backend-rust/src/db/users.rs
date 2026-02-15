use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::{User, CreateUserRequest, UpdateUserRequest};

fn map_user_row(r: &SqliteRow) -> User {
    let enabled_int: i32 = r.get("enabled");
    User {
        id: r.get("id"),
        username: r.get("username"),
        password_hash: r.get("password_hash"),
        enabled: enabled_int != 0,
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

/// User database operations
pub struct UserRepo;

impl UserRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<User>> {
        let rows = sqlx::query("SELECT * FROM users ORDER BY username")
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_user_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<User>> {
        let row = sqlx::query("SELECT * FROM users WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_user_row))
    }

    pub async fn get_by_username(pool: &Pool<Sqlite>, username: &str) -> Result<Option<User>> {
        let row = sqlx::query("SELECT * FROM users WHERE username = ?")
            .bind(username)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_user_row))
    }

    pub async fn create(
        pool: &Pool<Sqlite>,
        username: &str,
        password_hash: &str,
    ) -> Result<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO users (username, password_hash, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(username)
        .bind(password_hash)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn create_full(pool: &Pool<Sqlite>, req: &CreateUserRequest) -> Result<User> {
        let now = Utc::now();
        let password_hash = bcrypt::hash(&req.password, bcrypt::DEFAULT_COST)
            .map_err(|e| anyhow::anyhow!("password hash error: {}", e))?;
        let result = sqlx::query(
            "INSERT INTO users (username, password_hash, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&req.username)
        .bind(&password_hash)
        .bind(req.enabled as i32)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;
        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id).await?.context("User not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &UpdateUserRequest) -> Result<User> {
        let now = Utc::now();
        if let Some(ref password) = req.password {
            if !password.is_empty() {
                let password_hash = bcrypt::hash(password, bcrypt::DEFAULT_COST)
                    .map_err(|e| anyhow::anyhow!("password hash error: {}", e))?;
                let result = sqlx::query(
                    "UPDATE users SET username = ?, password_hash = ?, enabled = ?, updated_at = ? WHERE id = ?"
                )
                .bind(&req.username)
                .bind(&password_hash)
                .bind(req.enabled as i32)
                .bind(now)
                .bind(id)
                .execute(pool)
                .await?;
                if result.rows_affected() == 0 {
                    return Err(super::NotFoundError::new("User", &id.to_string()).into());
                }
                return Self::get(pool, id).await?.context("User not found after update");
            }
        }
        let result = sqlx::query(
            "UPDATE users SET username = ?, enabled = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&req.username)
        .bind(req.enabled as i32)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("User", &id.to_string()).into());
        }
        Self::get(pool, id).await?.context("User not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM users WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("User", &id.to_string()).into());
        }
        Ok(())
    }
}
