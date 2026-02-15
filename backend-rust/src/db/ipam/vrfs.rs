use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Row, Sqlite};

use crate::models::*;
use super::helpers::*;

// ========== Role Repo ==========

pub struct IpamRoleRepo;

impl IpamRoleRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRole>> {
        let rows = sqlx::query("SELECT * FROM ipam_roles ORDER BY name")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(map_role_row).collect())
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRoleRequest) -> Result<IpamRole> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_roles (id, name, description, created_at) VALUES (?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(now)
            .execute(pool).await?;
        let row = sqlx::query("SELECT * FROM ipam_roles WHERE id = ?")
            .bind(&req.id).fetch_one(pool).await?;
        Ok(map_role_row(&row))
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_roles WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Role", id).into());
        }
        Ok(())
    }
}

// ========== VRF Repo ==========

pub struct IpamVrfRepo;

impl IpamVrfRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamVrf>> {
        let rows = sqlx::query(
            r#"SELECT v.*,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE vrf_id = v.id), 0) as prefix_count
               FROM ipam_vrfs v ORDER BY v.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_vrf_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamVrf>> {
        let row = sqlx::query(
            r#"SELECT v.*,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE vrf_id = v.id), 0) as prefix_count
               FROM ipam_vrfs v WHERE v.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_vrf_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamVrfRequest) -> Result<IpamVrf> {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO ipam_vrfs (id, name, rd, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&req.id).bind(&req.name)
        .bind(req.rd.as_deref().unwrap_or(""))
        .bind(req.description.as_deref().unwrap_or(""))
        .bind(now).bind(now)
        .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("VRF not found after creation")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_vrfs WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("VRF", id).into());
        }
        Ok(())
    }
}

// ========== Tag Repo ==========

pub struct IpamTagRepo;

impl IpamTagRepo {
    pub async fn list_for_resource(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str) -> Result<Vec<IpamTag>> {
        let rows = sqlx::query(
            "SELECT * FROM ipam_tags WHERE resource_type = ? AND resource_id = ? ORDER BY key"
        ).bind(resource_type).bind(resource_id).fetch_all(pool).await?;
        Ok(rows.iter().map(map_tag_row).collect())
    }

    pub async fn set(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str, key: &str, value: &str) -> Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"INSERT INTO ipam_tags (resource_type, resource_id, key, value, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(resource_type, resource_id, key) DO UPDATE SET value = excluded.value"#
        )
        .bind(resource_type).bind(resource_id).bind(key).bind(value).bind(now)
        .execute(pool).await?;
        Ok(())
    }

    pub async fn delete(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str, key: &str) -> Result<()> {
        sqlx::query("DELETE FROM ipam_tags WHERE resource_type = ? AND resource_id = ? AND key = ?")
            .bind(resource_type).bind(resource_id).bind(key)
            .execute(pool).await?;
        Ok(())
    }

    pub async fn list_distinct_keys(pool: &Pool<Sqlite>) -> Result<Vec<String>> {
        let rows = sqlx::query("SELECT DISTINCT key FROM ipam_tags ORDER BY key")
            .fetch_all(pool).await?;
        Ok(rows.iter().map(|r| r.get::<String, _>("key")).collect())
    }

    pub async fn delete_all_for_resource(pool: &Pool<Sqlite>, resource_type: &str, resource_id: &str) -> Result<()> {
        sqlx::query("DELETE FROM ipam_tags WHERE resource_type = ? AND resource_id = ?")
            .bind(resource_type).bind(resource_id)
            .execute(pool).await?;
        Ok(())
    }
}
