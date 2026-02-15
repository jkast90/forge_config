use anyhow::Result;
use sqlx::{Pool, Row, Sqlite, sqlite::SqliteRow};

use crate::models::*;

use super::row_helpers::none_if_empty;

fn map_row(row: &SqliteRow) -> PortAssignment {
    PortAssignment {
        id: row.get("id"),
        device_id: row.get("device_id"),
        port_name: row.get("port_name"),
        remote_device_id: row.try_get::<Option<i64>, _>("remote_device_id").ok().flatten(),
        remote_port_name: row.get("remote_port_name"),
        description: none_if_empty(row.get("description")),
        patch_panel_a_id: row.try_get::<Option<i64>, _>("patch_panel_a_id").ok().flatten(),
        patch_panel_a_port: none_if_empty(row.get("patch_panel_a_port")),
        patch_panel_b_id: row.try_get::<Option<i64>, _>("patch_panel_b_id").ok().flatten(),
        patch_panel_b_port: none_if_empty(row.get("patch_panel_b_port")),
        remote_device_hostname: none_if_empty(row.get("remote_device_hostname")),
        remote_device_type: none_if_empty(row.get("remote_device_type")),
        patch_panel_a_hostname: none_if_empty(row.get("patch_panel_a_hostname")),
        patch_panel_b_hostname: none_if_empty(row.get("patch_panel_b_hostname")),
        vrf_id: none_if_empty(row.get("vrf_id")),
        vrf_name: none_if_empty(row.try_get("vrf_name").unwrap_or_default()),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

const SELECT_PORT_ASSIGNMENT: &str = r#"
    SELECT pa.id, pa.device_id, pa.port_name,
           pa.remote_device_id, pa.remote_port_name, pa.description,
           pa.patch_panel_a_id, pa.patch_panel_a_port,
           pa.patch_panel_b_id, pa.patch_panel_b_port,
           pa.vrf_id,
           pa.created_at, pa.updated_at,
           rd.hostname AS remote_device_hostname,
           rd.device_type AS remote_device_type,
           ppa.hostname AS patch_panel_a_hostname,
           ppb.hostname AS patch_panel_b_hostname,
           vrf.name AS vrf_name
    FROM device_port_assignments pa
    LEFT JOIN devices rd ON rd.id = pa.remote_device_id
    LEFT JOIN devices ppa ON ppa.id = pa.patch_panel_a_id
    LEFT JOIN devices ppb ON ppb.id = pa.patch_panel_b_id
    LEFT JOIN ipam_vrfs vrf ON vrf.id = pa.vrf_id
"#;

pub struct PortAssignmentRepo;

impl PortAssignmentRepo {
    /// List all port assignments for a device (forward direction)
    pub async fn list_for_device(pool: &Pool<Sqlite>, device_id: i64) -> Result<Vec<PortAssignment>> {
        let rows = sqlx::query(&format!(
            "{} WHERE pa.device_id = ? ORDER BY pa.port_name",
            SELECT_PORT_ASSIGNMENT
        ))
        .bind(device_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_row).collect())
    }

    /// List all port assignments that reference a device as a patch panel
    pub async fn list_for_patch_panel(pool: &Pool<Sqlite>, pp_device_id: i64) -> Result<Vec<PortAssignment>> {
        let rows = sqlx::query(&format!(
            "{} WHERE pa.patch_panel_a_id = ? OR pa.patch_panel_b_id = ? ORDER BY pa.port_name",
            SELECT_PORT_ASSIGNMENT
        ))
        .bind(pp_device_id)
        .bind(pp_device_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.iter().map(map_row).collect())
    }

    /// Upsert a single port assignment
    pub async fn set(pool: &Pool<Sqlite>, device_id: i64, req: &SetPortAssignmentRequest) -> Result<PortAssignment> {
        let now = chrono::Utc::now();
        sqlx::query(
            r#"
            INSERT INTO device_port_assignments (device_id, port_name, remote_device_id, remote_port_name, description,
                patch_panel_a_id, patch_panel_a_port, patch_panel_b_id, patch_panel_b_port, vrf_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id, port_name) DO UPDATE SET
                remote_device_id = excluded.remote_device_id,
                remote_port_name = excluded.remote_port_name,
                description = excluded.description,
                patch_panel_a_id = excluded.patch_panel_a_id,
                patch_panel_a_port = excluded.patch_panel_a_port,
                patch_panel_b_id = excluded.patch_panel_b_id,
                patch_panel_b_port = excluded.patch_panel_b_port,
                vrf_id = excluded.vrf_id,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(device_id)
        .bind(&req.port_name)
        .bind(&req.remote_device_id)
        .bind(&req.remote_port_name)
        .bind(&req.description)
        .bind(&req.patch_panel_a_id)
        .bind(&req.patch_panel_a_port)
        .bind(&req.patch_panel_b_id)
        .bind(&req.patch_panel_b_port)
        .bind(&req.vrf_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;

        // Return the upserted row
        let row = sqlx::query(&format!(
            "{} WHERE pa.device_id = ? AND pa.port_name = ?",
            SELECT_PORT_ASSIGNMENT
        ))
        .bind(device_id)
        .bind(&req.port_name)
        .fetch_one(pool)
        .await?;

        Ok(map_row(&row))
    }

    /// Replace all port assignments for a device
    pub async fn bulk_set(pool: &Pool<Sqlite>, device_id: i64, assignments: &[SetPortAssignmentRequest]) -> Result<Vec<PortAssignment>> {
        let now = chrono::Utc::now();

        // Delete existing assignments
        sqlx::query("DELETE FROM device_port_assignments WHERE device_id = ?")
            .bind(device_id)
            .execute(pool)
            .await?;

        // Insert new assignments
        for req in assignments {
            sqlx::query(
                r#"
                INSERT INTO device_port_assignments (device_id, port_name, remote_device_id, remote_port_name, description,
                    patch_panel_a_id, patch_panel_a_port, patch_panel_b_id, patch_panel_b_port, vrf_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                "#,
            )
            .bind(device_id)
            .bind(&req.port_name)
            .bind(&req.remote_device_id)
            .bind(&req.remote_port_name)
            .bind(&req.description)
            .bind(&req.patch_panel_a_id)
            .bind(&req.patch_panel_a_port)
            .bind(&req.patch_panel_b_id)
            .bind(&req.patch_panel_b_port)
            .bind(&req.vrf_id)
            .bind(now)
            .bind(now)
            .execute(pool)
            .await?;
        }

        Self::list_for_device(pool, device_id).await
    }

    /// Delete a single port assignment
    pub async fn delete(pool: &Pool<Sqlite>, device_id: i64, port_name: &str) -> Result<()> {
        sqlx::query("DELETE FROM device_port_assignments WHERE device_id = ? AND port_name = ?")
            .bind(device_id)
            .bind(port_name)
            .execute(pool)
            .await?;
        Ok(())
    }
}
