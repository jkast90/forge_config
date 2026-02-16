use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;
use super::row_helpers::none_if_empty;

fn map_gpu_cluster_row(row: &SqliteRow) -> GpuCluster {
    GpuCluster {
        id: row.get("id"),
        name: row.get("name"),
        description: none_if_empty(row.get("description")),
        gpu_model: row.get("gpu_model"),
        node_count: row.get("node_count"),
        gpus_per_node: row.get("gpus_per_node"),
        interconnect_type: row.get("interconnect_type"),
        status: row.get("status"),
        topology_id: row.try_get::<Option<i64>, _>("topology_id").ok().flatten(),
        vrf_id: row.try_get::<Option<i64>, _>("vrf_id").ok().flatten(),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

pub struct GpuClusterRepo;

impl GpuClusterRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<GpuCluster>> {
        let rows = sqlx::query("SELECT * FROM gpu_clusters ORDER BY name")
            .fetch_all(pool)
            .await?;
        Ok(rows.iter().map(map_gpu_cluster_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: i64) -> Result<Option<GpuCluster>> {
        let row = sqlx::query("SELECT * FROM gpu_clusters WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        Ok(row.as_ref().map(map_gpu_cluster_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateGpuClusterRequest) -> Result<GpuCluster> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            INSERT INTO gpu_clusters (name, description, gpu_model, node_count, gpus_per_node, interconnect_type, status, topology_id, vrf_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.gpu_model)
        .bind(req.node_count)
        .bind(req.gpus_per_node)
        .bind(&req.interconnect_type)
        .bind(&req.status)
        .bind(req.topology_id)
        .bind(req.vrf_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        let new_id = result.last_insert_rowid();
        Self::get(pool, new_id)
            .await?
            .context("GPU cluster not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: i64, req: &CreateGpuClusterRequest) -> Result<GpuCluster> {
        let now = Utc::now();
        let result = sqlx::query(
            r#"
            UPDATE gpu_clusters SET name = ?, description = ?, gpu_model = ?, node_count = ?, gpus_per_node = ?,
                                    interconnect_type = ?, status = ?, topology_id = ?, vrf_id = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.gpu_model)
        .bind(req.node_count)
        .bind(req.gpus_per_node)
        .bind(&req.interconnect_type)
        .bind(&req.status)
        .bind(req.topology_id)
        .bind(req.vrf_id)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("GPU cluster", &id.to_string()).into());
        }

        Self::get(pool, id)
            .await?
            .context("GPU cluster not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: i64) -> Result<()> {
        let result = sqlx::query("DELETE FROM gpu_clusters WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(super::NotFoundError::new("GPU cluster", &id.to_string()).into());
        }
        Ok(())
    }
}
