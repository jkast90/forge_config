mod devices;
mod dhcp_options;
mod discovery;
mod jobs;
mod row_helpers;
pub mod seeds;
mod settings;
mod templates;
mod topologies;
mod users;
mod vendor_actions;
mod vendors;

use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};

use crate::models::*;

/// Typed error for "resource not found" — enables reliable downcast
/// in the API error handler instead of fragile string matching.
#[derive(Debug)]
pub struct NotFoundError {
    pub resource: String,
    pub id: String,
}

impl NotFoundError {
    pub fn new(resource: &str, id: &str) -> Self {
        Self {
            resource: resource.to_string(),
            id: id.to_string(),
        }
    }
}

impl std::fmt::Display for NotFoundError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} not found: {}", self.resource, self.id)
    }
}

impl std::error::Error for NotFoundError {}

/// Store handles all database operations, delegating to per-entity repo modules.
#[derive(Clone)]
pub struct Store {
    pool: Pool<Sqlite>,
}

impl Store {
    /// Create a new database store with configurable pool size
    pub async fn new(db_path: &str) -> Result<Self> {
        Self::with_pool_size(db_path, 5).await
    }

    /// Create a new database store with a specific pool size
    pub async fn with_pool_size(db_path: &str, max_connections: u32) -> Result<Self> {
        let db_url = format!("sqlite:{}?mode=rwc", db_path);

        let pool = SqlitePoolOptions::new()
            .max_connections(max_connections)
            .connect(&db_url)
            .await
            .context("Failed to connect to database")?;

        let store = Self { pool };
        store.migrate().await?;
        Ok(store)
    }

    /// Run database migrations
    async fn migrate(&self) -> Result<()> {
        sqlx::migrate!("./migrations")
            .run(&self.pool)
            .await
            .context("Failed to run database migrations")?;

        // Initialize default settings if not exists
        let count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM settings")
            .fetch_one(&self.pool)
            .await?;

        if count.0 == 0 {
            let defaults = Settings::default();
            let data = serde_json::to_string(&defaults)?;
            sqlx::query("INSERT INTO settings (id, data) VALUES (1, ?)")
                .bind(&data)
                .execute(&self.pool)
                .await?;
        }

        // Seed defaults
        self.seed_default_vendors().await?;
        self.seed_default_templates().await?;
        self.seed_default_dhcp_options().await?;
        self.seed_default_user().await?;
        self.seed_default_vendor_actions().await?;

        Ok(())
    }

    async fn seed_default_vendors(&self) -> Result<()> {
        for (id, name, backup_command, deploy_command, ssh_port, mac_json, vendor_class, default_template) in seeds::seed_vendor_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO vendors (id, name, backup_command, deploy_command, ssh_port, mac_prefixes, vendor_class, default_template, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(&name)
            .bind(&backup_command)
            .bind(&deploy_command)
            .bind(ssh_port)
            .bind(&mac_json)
            .bind(&vendor_class)
            .bind(&default_template)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_templates(&self) -> Result<()> {
        for (id, name, description, vendor_id, content) in seeds::seed_template_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO templates (id, name, description, vendor_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(&name)
            .bind(&description)
            .bind(&vendor_id)
            .bind(&content)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_dhcp_options(&self) -> Result<()> {
        for (id, option_number, name, value, option_type, vendor_id, description, enabled) in seeds::seed_dhcp_option_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO dhcp_options (id, option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(option_number)
            .bind(&name)
            .bind(&value)
            .bind(&option_type)
            .bind(&vendor_id)
            .bind(&description)
            .bind(enabled)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_user(&self) -> Result<()> {
        let count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM users")
            .fetch_one(&self.pool)
            .await?;

        if count.0 == 0 {
            let id = uuid::Uuid::new_v4().to_string();
            let password_hash = bcrypt::hash("admin", bcrypt::DEFAULT_COST)
                .map_err(|e| anyhow::anyhow!("Failed to hash default password: {}", e))?;

            self.create_user(&id, "admin", &password_hash).await?;
            tracing::info!("Created default admin user (username: admin, password: admin)");
        }

        Ok(())
    }

    async fn seed_default_vendor_actions(&self) -> Result<()> {
        // Only seed if table is empty
        let count: (i32,) = sqlx::query_as("SELECT COUNT(*) FROM vendor_actions")
            .fetch_one(&self.pool)
            .await?;
        if count.0 > 0 {
            return Ok(());
        }

        for (id, vendor_id, label, command, sort_order) in seeds::seed_vendor_action_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO vendor_actions (id, vendor_id, label, command, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(&vendor_id)
            .bind(&label)
            .bind(&command)
            .bind(sort_order)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    // ========== User Operations ==========

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        users::UserRepo::get_by_username(&self.pool, username).await
    }

    pub async fn create_user(&self, id: &str, username: &str, password_hash: &str) -> Result<()> {
        users::UserRepo::create(&self.pool, id, username, password_hash).await
    }

    // ========== Device Operations ==========

    pub async fn list_devices(&self) -> Result<Vec<Device>> {
        devices::DeviceRepo::list(&self.pool).await
    }

    pub async fn list_devices_paged(&self, limit: i32, offset: i32) -> Result<Vec<Device>> {
        devices::DeviceRepo::list_paged(&self.pool, limit, offset).await
    }

    pub async fn get_device(&self, mac: &str) -> Result<Option<Device>> {
        devices::DeviceRepo::get(&self.pool, mac).await
    }

    pub async fn create_device(&self, req: &CreateDeviceRequest) -> Result<Device> {
        devices::DeviceRepo::create(&self.pool, req).await
    }

    pub async fn update_device(&self, mac: &str, req: &UpdateDeviceRequest) -> Result<Device> {
        devices::DeviceRepo::update(&self.pool, mac, req).await
    }

    pub async fn delete_device(&self, mac: &str) -> Result<()> {
        devices::DeviceRepo::delete(&self.pool, mac).await
    }

    pub async fn update_device_status(&self, mac: &str, status: &str) -> Result<()> {
        devices::DeviceRepo::update_status(&self.pool, mac, status).await
    }

    pub async fn update_device_backup_time(&self, mac: &str) -> Result<()> {
        devices::DeviceRepo::update_backup_time(&self.pool, mac).await
    }

    pub async fn update_device_error(&self, mac: &str, error_msg: &str) -> Result<()> {
        devices::DeviceRepo::update_error(&self.pool, mac, error_msg).await
    }

    pub async fn clear_device_error(&self, mac: &str) -> Result<()> {
        devices::DeviceRepo::update_error(&self.pool, mac, "").await
    }

    // ========== Settings Operations ==========

    pub async fn get_settings(&self) -> Result<Settings> {
        settings::SettingsRepo::get(&self.pool).await
    }

    pub async fn update_settings(&self, s: &Settings) -> Result<()> {
        settings::SettingsRepo::update(&self.pool, s).await
    }

    // ========== Backup Operations ==========

    pub async fn create_backup(&self, device_mac: &str, filename: &str, size: i64) -> Result<Backup> {
        settings::BackupRepo::create(&self.pool, device_mac, filename, size).await
    }

    pub async fn list_backups(&self, mac: &str) -> Result<Vec<Backup>> {
        settings::BackupRepo::list(&self.pool, mac).await
    }

    pub async fn get_backup(&self, id: i64) -> Result<Option<Backup>> {
        settings::BackupRepo::get(&self.pool, id).await
    }

    // ========== Vendor Operations ==========

    pub async fn list_vendors(&self) -> Result<Vec<Vendor>> {
        vendors::VendorRepo::list(&self.pool).await
    }

    pub async fn get_vendor(&self, id: &str) -> Result<Option<Vendor>> {
        vendors::VendorRepo::get(&self.pool, id).await
    }

    pub async fn create_vendor(&self, req: &CreateVendorRequest) -> Result<Vendor> {
        vendors::VendorRepo::create(&self.pool, req).await
    }

    pub async fn update_vendor(&self, id: &str, req: &CreateVendorRequest) -> Result<Vendor> {
        vendors::VendorRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_vendor(&self, id: &str) -> Result<()> {
        vendors::VendorRepo::delete(&self.pool, id).await
    }

    // ========== DHCP Option Operations ==========

    pub async fn list_dhcp_options(&self) -> Result<Vec<DhcpOption>> {
        dhcp_options::DhcpOptionRepo::list(&self.pool).await
    }

    pub async fn get_dhcp_option(&self, id: &str) -> Result<Option<DhcpOption>> {
        dhcp_options::DhcpOptionRepo::get(&self.pool, id).await
    }

    pub async fn create_dhcp_option(&self, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        dhcp_options::DhcpOptionRepo::create(&self.pool, req).await
    }

    pub async fn update_dhcp_option(&self, id: &str, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        dhcp_options::DhcpOptionRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_dhcp_option(&self, id: &str) -> Result<()> {
        dhcp_options::DhcpOptionRepo::delete(&self.pool, id).await
    }

    // ========== Template Operations ==========

    pub async fn list_templates(&self) -> Result<Vec<Template>> {
        templates::TemplateRepo::list(&self.pool).await
    }

    pub async fn get_template(&self, id: &str) -> Result<Option<Template>> {
        templates::TemplateRepo::get(&self.pool, id).await
    }

    pub async fn create_template(&self, req: &CreateTemplateRequest) -> Result<Template> {
        templates::TemplateRepo::create(&self.pool, req).await
    }

    pub async fn update_template(&self, id: &str, req: &CreateTemplateRequest) -> Result<Template> {
        templates::TemplateRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_template(&self, id: &str) -> Result<()> {
        templates::TemplateRepo::delete(&self.pool, id).await
    }

    // ========== Discovery Operations ==========

    pub async fn create_discovery_log(&self, req: &CreateDiscoveryLogRequest) -> Result<DiscoveryLog> {
        discovery::DiscoveryRepo::create_log(&self.pool, req).await
    }

    pub async fn list_discovery_logs(&self, limit: i32) -> Result<Vec<DiscoveryLog>> {
        discovery::DiscoveryRepo::list_logs(&self.pool, limit).await
    }

    pub async fn clear_discovery_logs(&self) -> Result<()> {
        discovery::DiscoveryRepo::clear_logs(&self.pool).await
    }

    pub async fn upsert_discovered_device(&self, lease: &Lease) -> Result<()> {
        discovery::DiscoveryRepo::upsert_discovered_device(&self.pool, lease).await
    }

    pub async fn list_discovered_devices(&self) -> Result<Vec<Lease>> {
        discovery::DiscoveryRepo::list_discovered_devices(&self.pool).await
    }

    pub async fn delete_discovered_device(&self, mac: &str) -> Result<()> {
        discovery::DiscoveryRepo::delete_discovered_device(&self.pool, mac).await
    }

    pub async fn clear_discovered_devices(&self) -> Result<()> {
        discovery::DiscoveryRepo::clear_discovered_devices(&self.pool).await
    }

    pub async fn cleanup_stale_discovered_devices(&self) -> Result<u64> {
        discovery::DiscoveryRepo::cleanup_stale_discovered_devices(&self.pool).await
    }

    // ========== NetBox Config Operations ==========

    pub async fn get_netbox_config(&self) -> Result<NetBoxConfig> {
        settings::NetBoxConfigRepo::get(&self.pool).await
    }

    pub async fn save_netbox_config(&self, config: &NetBoxConfig) -> Result<()> {
        settings::NetBoxConfigRepo::save(&self.pool, config).await
    }

    // ========== Vendor Action Operations ==========

    pub async fn list_vendor_actions(&self) -> Result<Vec<VendorAction>> {
        vendor_actions::VendorActionRepo::list_all(&self.pool).await
    }

    pub async fn list_vendor_actions_by_vendor(&self, vendor_id: &str) -> Result<Vec<VendorAction>> {
        vendor_actions::VendorActionRepo::list_by_vendor(&self.pool, vendor_id).await
    }

    pub async fn create_vendor_action(&self, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        vendor_actions::VendorActionRepo::create(&self.pool, req).await
    }

    pub async fn update_vendor_action(&self, id: &str, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        vendor_actions::VendorActionRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_vendor_action(&self, id: &str) -> Result<()> {
        vendor_actions::VendorActionRepo::delete(&self.pool, id).await
    }

    // ========== Job Operations ==========

    pub async fn create_job(&self, id: &str, req: &CreateJobRequest) -> Result<Job> {
        jobs::JobRepo::create(&self.pool, id, req).await
    }

    pub async fn get_job(&self, id: &str) -> Result<Option<Job>> {
        jobs::JobRepo::get(&self.pool, id).await
    }

    pub async fn update_job_started(&self, id: &str) -> Result<()> {
        jobs::JobRepo::update_started(&self.pool, id).await
    }

    pub async fn update_job_completed(&self, id: &str, output: &str) -> Result<()> {
        jobs::JobRepo::update_completed(&self.pool, id, output).await
    }

    pub async fn update_job_failed(&self, id: &str, error: &str) -> Result<()> {
        jobs::JobRepo::update_failed(&self.pool, id, error).await
    }

    pub async fn list_jobs_by_device(&self, mac: &str, limit: i32) -> Result<Vec<Job>> {
        jobs::JobRepo::list_by_device(&self.pool, mac, limit).await
    }

    pub async fn list_jobs_recent(&self, limit: i32) -> Result<Vec<Job>> {
        jobs::JobRepo::list_recent(&self.pool, limit).await
    }

    pub async fn list_jobs_stuck(&self) -> Result<Vec<Job>> {
        jobs::JobRepo::list_stuck(&self.pool).await
    }

    // ========== Topology Operations ==========

    pub async fn list_topologies(&self) -> Result<Vec<Topology>> {
        topologies::TopologyRepo::list(&self.pool).await
    }

    pub async fn get_topology(&self, id: &str) -> Result<Option<Topology>> {
        topologies::TopologyRepo::get(&self.pool, id).await
    }

    pub async fn create_topology(&self, req: &CreateTopologyRequest) -> Result<Topology> {
        topologies::TopologyRepo::create(&self.pool, req).await
    }

    pub async fn update_topology(&self, id: &str, req: &CreateTopologyRequest) -> Result<Topology> {
        topologies::TopologyRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_topology(&self, id: &str) -> Result<()> {
        topologies::TopologyRepo::delete(&self.pool, id).await
    }
}

// Re-export seed helpers for the API
pub use seeds::{get_default_dhcp_options_models, get_default_vendors_models};
