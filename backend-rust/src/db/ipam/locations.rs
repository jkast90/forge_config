use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite};

use crate::models::*;
use super::helpers::*;

// ========== Region Repo ==========

pub struct IpamRegionRepo;

impl IpamRegionRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRegion>> {
        let rows = sqlx::query(
            r#"SELECT r.*, COALESCE((SELECT COUNT(*) FROM ipam_locations WHERE region_id = r.id), 0) as campus_count
               FROM ipam_regions r ORDER BY r.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_region_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamRegion>> {
        let row = sqlx::query(
            r#"SELECT r.*, COALESCE((SELECT COUNT(*) FROM ipam_locations WHERE region_id = r.id), 0) as campus_count
               FROM ipam_regions r WHERE r.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_region_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_regions (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Region not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamRegionRequest) -> Result<IpamRegion> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_regions SET name = ?, description = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or("")).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Region", id).into());
        }
        Self::get(pool, id).await?.context("Region not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_regions WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Region", id).into());
        }
        Ok(())
    }
}

// ========== Campus Repo ==========

pub struct IpamCampusRepo;

impl IpamCampusRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamCampus>> {
        let rows = sqlx::query(
            r#"SELECT l.*, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_datacenters WHERE location_id = l.id), 0) as datacenter_count
               FROM ipam_locations l
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               ORDER BY r.name, l.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_campus_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamCampus>> {
        let row = sqlx::query(
            r#"SELECT l.*, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_datacenters WHERE location_id = l.id), 0) as datacenter_count
               FROM ipam_locations l
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               WHERE l.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_campus_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamCampusRequest) -> Result<IpamCampus> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_locations (id, name, description, region_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.region_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Campus not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamCampusRequest) -> Result<IpamCampus> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_locations SET name = ?, description = ?, region_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.region_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Campus", id).into());
        }
        Self::get(pool, id).await?.context("Campus not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_locations WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Campus", id).into());
        }
        Ok(())
    }
}

// ========== Datacenter Repo ==========

pub struct IpamDatacenterRepo;

impl IpamDatacenterRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamDatacenter>> {
        let rows = sqlx::query(
            r#"SELECT dc.*, dc.location_id as campus_id, l.name as campus_name, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_halls WHERE datacenter_id = dc.id), 0) as hall_count,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE datacenter_id = dc.id), 0) as prefix_count
               FROM ipam_datacenters dc
               LEFT JOIN ipam_locations l ON dc.location_id = l.id
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               ORDER BY r.name, l.name, dc.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_datacenter_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamDatacenter>> {
        let row = sqlx::query(
            r#"SELECT dc.*, dc.location_id as campus_id, l.name as campus_name, r.name as region_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_halls WHERE datacenter_id = dc.id), 0) as hall_count,
                      COALESCE((SELECT COUNT(*) FROM ipam_prefixes WHERE datacenter_id = dc.id), 0) as prefix_count
               FROM ipam_datacenters dc
               LEFT JOIN ipam_locations l ON dc.location_id = l.id
               LEFT JOIN ipam_regions r ON l.region_id = r.id
               WHERE dc.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_datacenter_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_datacenters (id, name, description, location_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.campus_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Datacenter not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamDatacenterRequest) -> Result<IpamDatacenter> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_datacenters SET name = ?, description = ?, location_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.campus_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Datacenter", id).into());
        }
        Self::get(pool, id).await?.context("Datacenter not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_datacenters WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Datacenter", id).into());
        }
        Ok(())
    }
}

// ========== Hall Repo ==========

pub struct IpamHallRepo;

impl IpamHallRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamHall>> {
        let rows = sqlx::query(
            r#"SELECT h.*, dc.name as datacenter_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_rows WHERE hall_id = h.id), 0) as row_count
               FROM ipam_halls h
               LEFT JOIN ipam_datacenters dc ON h.datacenter_id = dc.id
               ORDER BY dc.name, h.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_hall_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamHall>> {
        let row = sqlx::query(
            r#"SELECT h.*, dc.name as datacenter_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_rows WHERE hall_id = h.id), 0) as row_count
               FROM ipam_halls h
               LEFT JOIN ipam_datacenters dc ON h.datacenter_id = dc.id
               WHERE h.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_hall_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamHallRequest) -> Result<IpamHall> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_halls (id, name, description, datacenter_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.datacenter_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Hall not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamHallRequest) -> Result<IpamHall> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_halls SET name = ?, description = ?, datacenter_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.datacenter_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Hall", id).into());
        }
        Self::get(pool, id).await?.context("Hall not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_halls WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Hall", id).into());
        }
        Ok(())
    }
}

// ========== Row Repo ==========

pub struct IpamRowRepo;

impl IpamRowRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRow>> {
        let rows = sqlx::query(
            r#"SELECT r.*, h.name as hall_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_racks WHERE row_id = r.id), 0) as rack_count
               FROM ipam_rows r
               LEFT JOIN ipam_halls h ON r.hall_id = h.id
               ORDER BY h.name, r.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_ipam_row_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamRow>> {
        let row = sqlx::query(
            r#"SELECT r.*, h.name as hall_name,
                      COALESCE((SELECT COUNT(*) FROM ipam_racks WHERE row_id = r.id), 0) as rack_count
               FROM ipam_rows r
               LEFT JOIN ipam_halls h ON r.hall_id = h.id
               WHERE r.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_ipam_row_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRowRequest) -> Result<IpamRow> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_rows (id, name, description, hall_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.hall_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Row not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamRowRequest) -> Result<IpamRow> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_rows SET name = ?, description = ?, hall_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.hall_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Row", id).into());
        }
        Self::get(pool, id).await?.context("Row not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_rows WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Row", id).into());
        }
        Ok(())
    }
}

// ========== Rack Repo ==========

pub struct IpamRackRepo;

impl IpamRackRepo {
    pub async fn list(pool: &Pool<Sqlite>) -> Result<Vec<IpamRack>> {
        let rows = sqlx::query(
            r#"SELECT rk.*, r.name as row_name,
                      COALESCE((SELECT COUNT(*) FROM devices WHERE rack_id = rk.id), 0) as device_count
               FROM ipam_racks rk
               LEFT JOIN ipam_rows r ON rk.row_id = r.id
               ORDER BY r.name, rk.name"#
        ).fetch_all(pool).await?;
        Ok(rows.iter().map(map_rack_row).collect())
    }

    pub async fn get(pool: &Pool<Sqlite>, id: &str) -> Result<Option<IpamRack>> {
        let row = sqlx::query(
            r#"SELECT rk.*, r.name as row_name,
                      COALESCE((SELECT COUNT(*) FROM devices WHERE rack_id = rk.id), 0) as device_count
               FROM ipam_racks rk
               LEFT JOIN ipam_rows r ON rk.row_id = r.id
               WHERE rk.id = ?"#
        ).bind(id).fetch_optional(pool).await?;
        Ok(row.as_ref().map(map_rack_row))
    }

    pub async fn create(pool: &Pool<Sqlite>, req: &CreateIpamRackRequest) -> Result<IpamRack> {
        let now = Utc::now();
        sqlx::query("INSERT INTO ipam_racks (id, name, description, row_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(&req.id).bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.row_id).bind(now).bind(now)
            .execute(pool).await?;
        Self::get(pool, &req.id).await?.context("Rack not found after creation")
    }

    pub async fn update(pool: &Pool<Sqlite>, id: &str, req: &CreateIpamRackRequest) -> Result<IpamRack> {
        let now = Utc::now();
        let result = sqlx::query("UPDATE ipam_racks SET name = ?, description = ?, row_id = ?, updated_at = ? WHERE id = ?")
            .bind(&req.name).bind(req.description.as_deref().unwrap_or(""))
            .bind(&req.row_id).bind(now).bind(id)
            .execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Rack", id).into());
        }
        Self::get(pool, id).await?.context("Rack not found after update")
    }

    pub async fn delete(pool: &Pool<Sqlite>, id: &str) -> Result<()> {
        let result = sqlx::query("DELETE FROM ipam_racks WHERE id = ?").bind(id).execute(pool).await?;
        if result.rows_affected() == 0 {
            return Err(crate::db::NotFoundError::new("Rack", id).into());
        }
        Ok(())
    }
}
