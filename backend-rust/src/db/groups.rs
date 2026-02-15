use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::{Group, GroupVariable, CreateGroupRequest};

fn map_group_row(row: &SqliteRow) -> Group {
    Group {
        id: row.get("id"),
        name: row.get("name"),
        description: super::row_helpers::none_if_empty(row.get("description")),
        parent_id: row.get("parent_id"),
        precedence: row.get("precedence"),
        device_count: row.try_get("device_count").ok(),
        child_count: row.try_get("child_count").ok(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn map_group_variable_row(row: &SqliteRow) -> GroupVariable {
    GroupVariable {
        id: row.get("id"),
        group_id: row.get("group_id"),
        key: row.get("key"),
        value: row.get("value"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

const SELECT_GROUP: &str = r#"
    SELECT g.id, g.name, g.description, g.parent_id, g.precedence,
           g.created_at, g.updated_at,
           COALESCE((SELECT COUNT(*) FROM device_group_members dgm WHERE dgm.group_id = g.id), 0) as device_count,
           COALESCE((SELECT COUNT(*) FROM groups c WHERE c.parent_id = g.id), 0) as child_count
    FROM groups g
"#;

pub struct GroupRepo;

impl GroupRepo {
    // ========== CRUD ==========

    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Group>> {
        let rows = sqlx::query(&format!("{} ORDER BY g.precedence ASC, g.name ASC", SELECT_GROUP))
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_group_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Group>> {
        let row = sqlx::query(&format!("{} WHERE g.id = ?", SELECT_GROUP))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_group_row))
    }

    pub async fn get_by_name(pool: &Pool<Sqlite>, name: &str) -> Result<Option<Group>> {
        let row = sqlx::query(&format!("{} WHERE g.name = ?", SELECT_GROUP))
            .bind(name)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_group_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateGroupRequest) -> Result<Group> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"INSERT INTO groups (name, description, parent_id, precedence, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&req.name)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.parent_id)
        .bind(req.precedence)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id)
            .await?
            .context("Group not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateGroupRequest) -> Result<Group> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"UPDATE groups SET name = ?, description = ?, parent_id = ?, precedence = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&req.name)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(&req.parent_id)
        .bind(req.precedence)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Group", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("Group not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        if id == 1 {
            return Err(anyhow::anyhow!("Cannot delete the 'all' group"));
        }
        let result = sqlx::query("DELETE FROM groups WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Group", &id.to_string()).into());
        }
        Ok(())
    }

    // ========== Group Variables ==========

    pub async fn list_variables(pool: &Pool<Sqlite>, group_id: i64) -> Result<Vec<GroupVariable>> {
        let rows = sqlx::query(
            "SELECT id, group_id, key, value, created_at, updated_at FROM group_variables WHERE group_id = ? ORDER BY key",
        )
        .bind(group_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.iter().map(map_group_variable_row).collect())
    }

    pub async fn set_variable(pool: &Pool<Sqlite>, group_id: i64, key: &str, value: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"INSERT INTO group_variables (group_id, key, value, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(group_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"#,
        )
        .bind(group_id)
        .bind(key)
        .bind(value)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn delete_variable(pool: &Pool<Sqlite>, group_id: i64, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM group_variables WHERE group_id = ? AND key = ?")
            .bind(group_id)
            .bind(key)
            .execute(pool)
            .await?;
        Ok(())
    }

    // ========== Membership ==========

    pub async fn list_group_members(pool: &Pool<Sqlite>, group_id: i64) -> Result<Vec<i64>> {
        let rows = sqlx::query(
            "SELECT device_id FROM device_group_members WHERE group_id = ? ORDER BY device_id",
        )
        .bind(group_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.iter().map(|r| r.get::<i64, _>("device_id")).collect())
    }

    pub async fn list_device_groups(pool: &Pool<Sqlite>, device_id: i64) -> Result<Vec<Group>> {
        let rows = sqlx::query(&format!(
            "{} WHERE g.id IN (SELECT group_id FROM device_group_members WHERE device_id = ?) ORDER BY g.precedence ASC",
            SELECT_GROUP
        ))
        .bind(device_id)
        .fetch_all(pool)
        .await?;
        Ok(rows.iter().map(map_group_row).collect())
    }

    pub async fn add_device_to_group(pool: &Pool<Sqlite>, device_id: i64, group_id: i64) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            "INSERT OR IGNORE INTO device_group_members (device_id, group_id, created_at) VALUES (?, ?, ?)",
        )
        .bind(device_id)
        .bind(group_id)
        .bind(now)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn remove_device_from_group(pool: &Pool<Sqlite>, device_id: i64, group_id: i64) -> Result<()> {
        sqlx::query("DELETE FROM device_group_members WHERE device_id = ? AND group_id = ?")
            .bind(device_id)
            .bind(group_id)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn set_group_members(pool: &Pool<Sqlite>, group_id: i64, device_ids: &[i64]) -> Result<()> {
        // Remove all existing members
        sqlx::query("DELETE FROM device_group_members WHERE group_id = ?")
            .bind(group_id)
            .execute(pool)
            .await?;

        // Add new members
        let now = Utc::now();
        for device_id in device_ids {
            sqlx::query(
                "INSERT OR IGNORE INTO device_group_members (device_id, group_id, created_at) VALUES (?, ?, ?)",
            )
            .bind(device_id)
            .bind(group_id)
            .bind(now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    pub async fn set_device_groups(pool: &Pool<Sqlite>, device_id: i64, group_ids: &[i64]) -> Result<()> {
        // Remove all existing memberships for this device
        sqlx::query("DELETE FROM device_group_members WHERE device_id = ?")
            .bind(device_id)
            .execute(pool)
            .await?;

        // Add new memberships
        let now = Utc::now();
        for group_id in group_ids {
            sqlx::query(
                "INSERT OR IGNORE INTO device_group_members (device_id, group_id, created_at) VALUES (?, ?, ?)",
            )
            .bind(device_id)
            .bind(group_id)
            .bind(now)
            .execute(pool)
            .await?;
        }
        Ok(())
    }

    // ========== Hierarchy ==========

    pub async fn get_children(pool: &Pool<Sqlite>, group_id: i64) -> Result<Vec<Group>> {
        let rows = sqlx::query(&format!("{} WHERE g.parent_id = ? ORDER BY g.precedence ASC", SELECT_GROUP))
            .bind(group_id)
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_group_row).collect())
    }

    /// Check if setting parent_id on group_id would create a cycle
    pub async fn would_create_cycle(pool: &Pool<Sqlite>, group_id: i64, proposed_parent_id: i64) -> Result<bool> {
        if group_id == proposed_parent_id {
            return Ok(true);
        }

        // Walk up from proposed_parent to see if we reach group_id
        let all_groups = sqlx::query("SELECT id, parent_id FROM groups")
            .fetch_all(pool)
            .await?;

        let parent_map: std::collections::HashMap<i64, Option<i64>> = all_groups
            .iter()
            .map(|r| {
                let id: i64 = r.get("id");
                let parent: Option<i64> = r.get("parent_id");
                (id, parent)
            })
            .collect();

        let mut current = Some(proposed_parent_id);
        let mut visited = std::collections::HashSet::new();

        while let Some(id) = current {
            if id == group_id {
                return Ok(true); // Cycle detected
            }
            if !visited.insert(id) {
                break; // Already visited, existing cycle in data
            }
            current = parent_map.get(&id).copied().flatten();
        }

        Ok(false)
    }

    // ========== Bulk helpers for variable resolution ==========

    /// Load all groups (for resolution algorithm)
    pub async fn list_all_raw(pool: &Pool<Sqlite>) -> Result<Vec<Group>> {
        let rows = sqlx::query(
            "SELECT id, name, description, parent_id, precedence, created_at, updated_at FROM groups ORDER BY precedence ASC",
        )
        .fetch_all(pool)
        .await?;
        Ok(rows.iter().map(|r| Group {
            id: r.get("id"),
            name: r.get("name"),
            description: super::row_helpers::none_if_empty(r.get("description")),
            parent_id: r.get("parent_id"),
            precedence: r.get("precedence"),
            device_count: None,
            child_count: None,
            created_at: r.get("created_at"),
            updated_at: r.get("updated_at"),
        }).collect())
    }

    /// Load all group variables for a set of group IDs
    pub async fn list_variables_for_groups(pool: &Pool<Sqlite>, group_ids: &[i64]) -> Result<Vec<GroupVariable>> {
        if group_ids.is_empty() {
            return Ok(vec![]);
        }
        // Build placeholders
        let placeholders: Vec<&str> = group_ids.iter().map(|_| "?").collect();
        let sql = format!(
            "SELECT id, group_id, key, value, created_at, updated_at FROM group_variables WHERE group_id IN ({}) ORDER BY group_id, key",
            placeholders.join(", ")
        );
        let mut query = sqlx::query(&sql);
        for id in group_ids {
            query = query.bind(id);
        }
        let rows = query.fetch_all(pool).await?;
        Ok(rows.iter().map(map_group_variable_row).collect())
    }
}
