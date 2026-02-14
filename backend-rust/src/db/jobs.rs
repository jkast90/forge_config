use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;

fn map_job_row(row: &SqliteRow) -> Job {
    Job {
        id: row.get("id"),
        job_type: row.get("job_type"),
        device_id: row.get("device_id"),
        command: row.get("command"),
        status: row.get("status"),
        output: row.get("output"),
        error: row.get("error"),
        created_at: row.get("created_at"),
        started_at: row.get("started_at"),
        completed_at: row.get("completed_at"),
    }
}

const SELECT_JOB: &str = r#"
    SELECT id, job_type, device_id, command, status, output, error,
           created_at, started_at, completed_at
    FROM jobs
"#;

pub struct JobRepo;

impl JobRepo {
    pub async fn create(pool: &Pool<Sqlite>, id: &str, req: &CreateJobRequest) -> Result<Job> {
        let now = Utc::now();
        sqlx::query(
            r#"
            INSERT INTO jobs (id, job_type, device_id, command, status, created_at)
            VALUES (?, ?, ?, ?, 'queued', ?)
            "#,
        )
        .bind(id)
        .bind(&req.job_type)
        .bind(&req.device_id)
        .bind(&req.command)
        .bind(now)
        .execute(pool)
        .await?;

        Self::get(pool, id)
            .await?
            .context("Job not found after creation")
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<Job>> {
        let row = sqlx::query(&format!("{} WHERE id = ?", SELECT_JOB))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_job_row))
    }

    pub async fn update_started(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        sqlx::query("UPDATE jobs SET status = 'running', started_at = ? WHERE id = ?")
            .bind(Utc::now())
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_completed(pool: &Pool<Sqlite>, id: &str, output: &str) -> Result<()> {
        sqlx::query("UPDATE jobs SET status = 'completed', output = ?, completed_at = ? WHERE id = ?")
            .bind(output)
            .bind(Utc::now())
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn update_failed(pool: &Pool<Sqlite>, id: &str, error: &str) -> Result<()> {
        sqlx::query("UPDATE jobs SET status = 'failed', error = ?, completed_at = ? WHERE id = ?")
            .bind(error)
            .bind(Utc::now())
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn list_by_device(pool: &Pool<Sqlite>, device_id: &str, limit: i32) -> Result<Vec<Job>> {
        let rows = sqlx::query(&format!("{} WHERE device_id = ? ORDER BY created_at DESC LIMIT ?", SELECT_JOB))
            .bind(device_id)
            .bind(limit)
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_job_row).collect())
    }

    pub async fn list_recent(pool: &Pool<Sqlite>, limit: i32) -> Result<Vec<Job>> {
        let rows = sqlx::query(&format!("{} ORDER BY created_at DESC LIMIT ?", SELECT_JOB))
            .bind(limit)
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_job_row).collect())
    }

    /// Find jobs that are stuck (queued or running) — used for crash recovery
    pub async fn list_stuck(pool: &Pool<Sqlite>) -> Result<Vec<Job>> {
        let rows = sqlx::query(&format!("{} WHERE status IN ('queued', 'running') ORDER BY created_at", SELECT_JOB))
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_job_row).collect())
    }
}
