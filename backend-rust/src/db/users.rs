use anyhow::Result;
use sqlx::{Pool, Row, Sqlite};

use crate::models::User;

/// User database operations
pub struct UserRepo;

impl UserRepo {
    pub async fn get_by_username(pool: &Pool<Sqlite>, username: &str) -> Result<Option<User>> {
        let row = sqlx::query(
            "SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?",
        )
        .bind(username)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|r| User {
            id: r.get("id"),
            username: r.get("username"),
            password_hash: r.get("password_hash"),
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }))
    }

    pub async fn create(
        pool: &Pool<Sqlite>,
        id: &str,
        username: &str,
        password_hash: &str,
    ) -> Result<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(id)
        .bind(username)
        .bind(password_hash)
        .execute(pool)
        .await?;
        Ok(())
    }
}
