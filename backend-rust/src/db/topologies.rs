use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;
use super::row_helpers::map_topology_row;

const SELECT_TOPOLOGY: &str = r#"
    SELECT t.id, t.name, t.description,
           t.region_id, t.campus_id, t.datacenter_id,
           t.created_at, t.updated_at,
           COALESCE(COUNT(d.mac), 0) as device_count,
           COALESCE(SUM(CASE WHEN d.topology_role = 'super-spine' THEN 1 ELSE 0 END), 0) as super_spine_count,
           COALESCE(SUM(CASE WHEN d.topology_role = 'spine' THEN 1 ELSE 0 END), 0) as spine_count,
           COALESCE(SUM(CASE WHEN d.topology_role = 'leaf' THEN 1 ELSE 0 END), 0) as leaf_count
    FROM topologies t
    LEFT JOIN devices d ON d.topology_id = CAST(t.id AS TEXT)
"#;

/// Topology database operations
pub struct TopologyRepo;

impl TopologyRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<Topology>> {
        let rows = sqlx::query(&format!("{} GROUP BY t.id ORDER BY t.name", SELECT_TOPOLOGY))
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_topology_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<Topology>> {
        let row = sqlx::query(&format!("{} WHERE t.id = ? GROUP BY t.id", SELECT_TOPOLOGY))
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_topology_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateTopologyRequest) -> Result<Topology> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"INSERT INTO topologies (name, description, region_id, campus_id, datacenter_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)"#,
        )
        .bind(&req.name)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(req.region_id)
        .bind(req.campus_id)
        .bind(req.datacenter_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id)
            .await?
            .context("Topology not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateTopologyRequest) -> Result<Topology> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"UPDATE topologies SET name = ?, description = ?, region_id = ?, campus_id = ?, datacenter_id = ?, updated_at = ? WHERE id = ?"#,
        )
        .bind(&req.name)
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(req.region_id)
        .bind(req.campus_id)
        .bind(req.datacenter_id)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Topology", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("Topology not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        // Unassign devices first (set topology_id and topology_role to empty)
        sqlx::query("UPDATE devices SET topology_id = '', topology_role = '' WHERE topology_id = CAST(? AS TEXT)")
            .bind(id)
            .execute(pool)
            .await?;

        let result = sqlx::query("DELETE FROM topologies WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("Topology", &id.to_string()).into());
        }
        Ok(())
    }
}
