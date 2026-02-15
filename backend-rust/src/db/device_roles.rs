use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};
use std::collections::HashMap;

use crate::models::*;
use super::row_helpers::none_if_empty;

// ========== Row Mapper ==========

fn map_device_role_row(row: &SqliteRow) -> DeviceRole {
    let group_names_json: String = row.get("group_names");
    let group_names: Vec<String> = serde_json::from_str(&group_names_json).unwrap_or_default();
    DeviceRole {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        template_ids: None,
        template_names: None,
        group_names,
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

// ========== Device Role Repo ==========

pub struct DeviceRoleRepo;

impl DeviceRoleRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<DeviceRole>> {
        let rows = sqlx::query("SELECT * FROM device_roles ORDER BY name")
            .fetch_all(pool).await?;
        let mut roles: Vec<DeviceRole> = rows.iter().map(map_device_role_row).collect();

        // Fetch template associations for all roles
        let assoc_rows = sqlx::query(
            r#"
            SELECT drt.role_id, drt.template_id, t.name as template_name
            FROM device_role_templates drt
            JOIN templates t ON t.id = drt.template_id
            ORDER BY drt.role_id, drt.sort_order
            "#,
        )
        .fetch_all(pool).await?;

        // Build a map of role_id -> (template_ids, template_names)
        let mut template_map: HashMap<String, (Vec<String>, Vec<String>)> = HashMap::new();
        for row in &assoc_rows {
            let role_id: String = row.get("role_id");
            let template_id: String = row.get("template_id");
            let template_name: String = row.get("template_name");
            let entry = template_map.entry(role_id).or_insert_with(|| (Vec::new(), Vec::new()));
            entry.0.push(template_id);
            entry.1.push(template_name);
        }

        // Merge template data into each role
        for role in &mut roles {
            if let Some((ids, names)) = template_map.remove(&role.id) {
                role.template_ids = Some(ids);
                role.template_names = Some(names);
            }
        }

        Ok(roles)
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<DeviceRole>> {
        let row = sqlx::query("SELECT * FROM device_roles WHERE id = ?")
            .bind(id).fetch_optional(pool).await?;
        let mut role = match row.as_ref().map(map_device_role_row) {
            Some(r) => r,
            None => return Ok(None),
        };

        // Fetch template associations
        let assoc_rows = sqlx::query(
            r#"
            SELECT drt.template_id, t.name as template_name
            FROM device_role_templates drt
            JOIN templates t ON t.id = drt.template_id
            WHERE drt.role_id = ?
            ORDER BY drt.sort_order
            "#,
        )
        .bind(id)
        .fetch_all(pool).await?;

        let mut template_ids = Vec::new();
        let mut template_names = Vec::new();
        for row in &assoc_rows {
            template_ids.push(row.get("template_id"));
            template_names.push(row.get("template_name"));
        }
        if !template_ids.is_empty() {
            role.template_ids = Some(template_ids);
            role.template_names = Some(template_names);
        }

        Ok(Some(role))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        let now = Utc::now();
        let group_names_json = serde_json::to_string(&req.group_names).unwrap_or_else(|_| "[]".to_string());
        sqlx::query(
            "INSERT INTO device_roles (id, name, description, group_names, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&group_names_json)
        .bind(now)
        .bind(now)
        .execute(pool).await?;

        Self::set_templates(pool, &req.id, &req.template_ids).await?;
        Self::get(pool, &req.id).await?.context("DeviceRole not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        let now = Utc::now();
        let group_names_json = serde_json::to_string(&req.group_names).unwrap_or_else(|_| "[]".to_string());
        let result = sqlx::query(
            "UPDATE device_roles SET name = ?, description = ?, group_names = ?, updated_at = ? WHERE id = ?"
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&group_names_json)
        .bind(now)
        .bind(id)
        .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("DeviceRole", id).into());
        }

        Self::set_templates(pool, id, &req.template_ids).await?;
        Self::get(pool, id).await?.context("DeviceRole not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM device_roles WHERE id = ?")
            .bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("DeviceRole", id).into());
        }
        Ok(())
    }

    pub async fn set_templates(pool: &Pool<Sqlite>, role_id: &str, template_ids: &[String]) -> Result<()> {
        // Delete all existing associations
        sqlx::query("DELETE FROM device_role_templates WHERE role_id = ?")
            .bind(role_id)
            .execute(pool).await?;

        // Insert new associations with sort_order
        for (i, template_id) in template_ids.iter().enumerate() {
            sqlx::query(
                "INSERT INTO device_role_templates (role_id, template_id, sort_order) VALUES (?, ?, ?)"
            )
            .bind(role_id)
            .bind(template_id)
            .bind(i as i32)
            .execute(pool).await?;
        }

        Ok(())
    }
}
