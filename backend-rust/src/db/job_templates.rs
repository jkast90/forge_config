use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;

fn map_row(row: &SqliteRow) -> JobTemplate {
    let device_ids_json: String = row.get("target_device_ids");
    let target_device_ids: Vec<i64> = if device_ids_json.is_empty() {
        vec![]
    } else {
        serde_json::from_str(&device_ids_json).unwrap_or_default()
    };

    JobTemplate {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        job_type: row.get("job_type"),
        command: row.get("command"),
        action_id: row.get("action_id"),
        target_mode: row.get("target_mode"),
        target_device_ids,
        target_group_id: row.get("target_group_id"),
        schedule: row.get("schedule"),
        enabled: row.get::<i32, _>("enabled") != 0,
        last_run_at: row.get("last_run_at"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        credential_id: row.get("credential_id"),
    }
}

pub struct JobTemplateRepo;

impl JobTemplateRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<JobTemplate>> {
        let rows = sqlx::query("SELECT * FROM job_templates ORDER BY name")
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<JobTemplate>> {
        let row = sqlx::query("SELECT * FROM job_templates WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        let now = Utc::now();
        let id = uuid::Uuid::new_v4().to_string();
        let device_ids_json = serde_json::to_string(&req.target_device_ids)?;

        sqlx::query(
            r#"INSERT INTO job_templates (id, name, description, job_type, command, action_id,
                target_mode, target_device_ids, target_group_id, schedule, enabled, created_at, updated_at, credential_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.job_type)
        .bind(&req.command)
        .bind(&req.action_id)
        .bind(&req.target_mode)
        .bind(&device_ids_json)
        .bind(&req.target_group_id)
        .bind(&req.schedule)
        .bind(req.enabled as i32)
        .bind(now)
        .bind(now)
        .bind(&req.credential_id)
        .execute(pool)
        .await?;

        Self::get(pool, &id)
            .await?
            .context("Job template not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        let now = Utc::now();
        let device_ids_json = serde_json::to_string(&req.target_device_ids)?;

        let result = sqlx::query(
            r#"UPDATE job_templates SET name = ?, description = ?, job_type = ?, command = ?,
                action_id = ?, target_mode = ?, target_device_ids = ?, target_group_id = ?,
                schedule = ?, enabled = ?, updated_at = ?, credential_id = ?
               WHERE id = ?"#,
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.job_type)
        .bind(&req.command)
        .bind(&req.action_id)
        .bind(&req.target_mode)
        .bind(&device_ids_json)
        .bind(&req.target_group_id)
        .bind(&req.schedule)
        .bind(req.enabled as i32)
        .bind(now)
        .bind(&req.credential_id)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Job template", id).into());
        }

        Self::get(pool, id)
            .await?
            .context("Job template not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM job_templates WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Job template", id).into());
        }
        Ok(())
    }

    pub async fn list_scheduled(pool: &Pool<Sqlite>) -> Result<Vec<JobTemplate>> {
        let rows = sqlx::query("SELECT * FROM job_templates WHERE schedule != '' AND enabled = 1")
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_row).collect())
    }

    pub async fn update_last_run(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query("UPDATE job_templates SET last_run_at = ?, updated_at = ? WHERE id = ?")
            .bind(now)
            .bind(now)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(())
    }
}
