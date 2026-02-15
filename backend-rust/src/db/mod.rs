mod credentials;
mod device_models;
mod device_roles;
mod device_variables;
mod devices;
mod dhcp_options;
mod port_assignments;
mod discovery;
mod groups;
mod ipam;
mod job_templates;
mod jobs;
mod output_parsers;
pub(crate) mod row_helpers;
pub mod seeds;
mod settings;
mod templates;
mod topologies;
mod users;
mod variable_resolution;
mod vendor_actions;
mod vendors;
mod store_ipam;

use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::collections::HashMap;

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
        self.seed_default_output_parsers().await?;
        self.seed_default_device_models().await?;
        self.seed_default_ipam_supernets().await?;

        // Ensure "all" group invariants
        self.ensure_all_group().await?;

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
            // Role templates (spine/leaf) use INSERT OR REPLACE so they stay
            // in sync with updated variable-based templates across upgrades.
            // Base templates use INSERT OR IGNORE so user edits are preserved.
            let sql = if seeds::is_role_template(&id) {
                r#"
                INSERT OR REPLACE INTO templates (id, name, description, vendor_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#
            } else {
                r#"
                INSERT OR IGNORE INTO templates (id, name, description, vendor_id, content, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#
            };
            sqlx::query(sql)
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
        // INSERT OR IGNORE ensures new seed actions are added to existing databases
        // without overwriting user-modified actions (matched by primary key)
        for (id, vendor_id, label, command, sort_order, action_type, webhook_url, webhook_method, webhook_headers, webhook_body) in seeds::seed_vendor_action_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO vendor_actions (id, vendor_id, label, command, sort_order, action_type, webhook_url, webhook_method, webhook_headers, webhook_body, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(&vendor_id)
            .bind(&label)
            .bind(&command)
            .bind(sort_order)
            .bind(&action_type)
            .bind(&webhook_url)
            .bind(&webhook_method)
            .bind(&webhook_headers)
            .bind(&webhook_body)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_output_parsers(&self) -> Result<()> {
        for parser in seeds::seed_output_parser_data() {
            // Insert the parser if it doesn't already exist (by name)
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO output_parsers (name, description, pattern, extract_names, enabled, created_at, updated_at)
                SELECT ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM output_parsers WHERE name = ?)
                "#,
            )
            .bind(parser.name)
            .bind(parser.description)
            .bind(parser.pattern)
            .bind(parser.extract_names)
            .bind(parser.name)
            .execute(&self.pool)
            .await?;

            // Link the parser to its vendor action (only if action has no parser yet)
            sqlx::query(
                r#"
                UPDATE vendor_actions
                SET output_parser_id = (SELECT id FROM output_parsers WHERE name = ?)
                WHERE id = ? AND output_parser_id IS NULL
                "#,
            )
            .bind(parser.name)
            .bind(parser.action_id)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_device_models(&self) -> Result<()> {
        for (id, vendor_id, model, display_name, rack_units, layout) in seeds::seed_device_model_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO device_models (id, vendor_id, model, display_name, rack_units, layout, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                "#,
            )
            .bind(&id)
            .bind(&vendor_id)
            .bind(&model)
            .bind(&display_name)
            .bind(rack_units)
            .bind(&layout)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_ipam_supernets(&self) -> Result<()> {
        for (prefix, description, is_supernet) in seeds::get_default_ipam_supernets() {
            let (network, broadcast, prefix_length) = crate::utils::parse_cidr(prefix)
                .map_err(|e| anyhow::anyhow!("{}", e))?;
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO ipam_prefixes (prefix, network_int, broadcast_int, prefix_length, description, status, is_supernet, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM ipam_prefixes WHERE network_int = ? AND broadcast_int = ?)
                "#,
            )
            .bind(prefix)
            .bind(network as i64)
            .bind(broadcast as i64)
            .bind(prefix_length as i32)
            .bind(description)
            .bind(if is_supernet { 1i32 } else { 0i32 })
            .bind(network as i64)
            .bind(broadcast as i64)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    // ========== User Operations ==========

    pub async fn list_users(&self) -> Result<Vec<User>> {
        users::UserRepo::list(&self.pool).await
    }

    pub async fn get_user(&self, id: &str) -> Result<Option<User>> {
        users::UserRepo::get(&self.pool, id).await
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        users::UserRepo::get_by_username(&self.pool, username).await
    }

    pub async fn create_user(&self, id: &str, username: &str, password_hash: &str) -> Result<()> {
        users::UserRepo::create(&self.pool, id, username, password_hash).await
    }

    pub async fn create_user_full(&self, id: &str, req: &CreateUserRequest) -> Result<User> {
        users::UserRepo::create_full(&self.pool, id, req).await
    }

    pub async fn update_user(&self, id: &str, req: &UpdateUserRequest) -> Result<User> {
        users::UserRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_user(&self, id: &str) -> Result<()> {
        users::UserRepo::delete(&self.pool, id).await
    }

    // ========== Device Operations ==========

    pub async fn list_devices(&self) -> Result<Vec<Device>> {
        devices::DeviceRepo::list(&self.pool).await
    }

    pub async fn list_devices_paged(&self, limit: i32, offset: i32) -> Result<Vec<Device>> {
        devices::DeviceRepo::list_paged(&self.pool, limit, offset).await
    }

    pub async fn get_device(&self, id: i64) -> Result<Option<Device>> {
        devices::DeviceRepo::get(&self.pool, id).await
    }

    pub async fn get_device_by_mac(&self, mac: &str) -> Result<Option<Device>> {
        devices::DeviceRepo::get_by_mac(&self.pool, mac).await
    }

    pub async fn create_device(&self, req: &CreateDeviceRequest) -> Result<Device> {
        devices::DeviceRepo::create(&self.pool, req).await
    }

    pub async fn update_device(&self, id: i64, req: &UpdateDeviceRequest) -> Result<Device> {
        devices::DeviceRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_device(&self, id: i64) -> Result<()> {
        devices::DeviceRepo::delete(&self.pool, id).await
    }

    pub async fn delete_devices_by_topology(&self, topology_id: &str) -> Result<u64> {
        devices::DeviceRepo::delete_by_topology(&self.pool, topology_id).await
    }

    pub async fn update_device_status(&self, id: i64, status: &str) -> Result<()> {
        devices::DeviceRepo::update_status(&self.pool, id, status).await
    }

    pub async fn update_device_backup_time(&self, id: i64) -> Result<()> {
        devices::DeviceRepo::update_backup_time(&self.pool, id).await
    }

    pub async fn update_device_error(&self, id: i64, error_msg: &str) -> Result<()> {
        devices::DeviceRepo::update_error(&self.pool, id, error_msg).await
    }

    pub async fn clear_device_error(&self, id: i64) -> Result<()> {
        devices::DeviceRepo::update_error(&self.pool, id, "").await
    }

    // ========== Settings Operations ==========

    pub async fn get_settings(&self) -> Result<Settings> {
        settings::SettingsRepo::get(&self.pool).await
    }

    pub async fn update_settings(&self, s: &Settings) -> Result<()> {
        settings::SettingsRepo::update(&self.pool, s).await
    }

    // ========== Device Variable Operations ==========

    pub async fn list_device_variables(&self, device_id: i64) -> Result<Vec<DeviceVariable>> {
        device_variables::DeviceVariableRepo::list_by_device(&self.pool, device_id).await
    }

    pub async fn list_variables_by_key(&self, key: &str) -> Result<Vec<DeviceVariable>> {
        device_variables::DeviceVariableRepo::list_by_key(&self.pool, key).await
    }

    pub async fn get_device_variable(&self, device_id: i64, key: &str) -> Result<Option<DeviceVariable>> {
        device_variables::DeviceVariableRepo::get(&self.pool, device_id, key).await
    }

    pub async fn set_device_variable(&self, device_id: i64, key: &str, value: &str) -> Result<()> {
        device_variables::DeviceVariableRepo::set(&self.pool, device_id, key, value).await
    }

    pub async fn delete_device_variable(&self, device_id: i64, key: &str) -> Result<()> {
        device_variables::DeviceVariableRepo::delete(&self.pool, device_id, key).await
    }

    pub async fn delete_all_device_variables(&self, device_id: i64) -> Result<()> {
        device_variables::DeviceVariableRepo::delete_all_for_device(&self.pool, device_id).await
    }

    pub async fn list_variable_keys(&self) -> Result<Vec<(String, i64)>> {
        device_variables::DeviceVariableRepo::list_keys(&self.pool).await
    }

    pub async fn bulk_set_device_variables(&self, entries: &[(i64, String, String)]) -> Result<()> {
        device_variables::DeviceVariableRepo::bulk_set(&self.pool, entries).await
    }

    pub async fn delete_variable_key(&self, key: &str) -> Result<()> {
        device_variables::DeviceVariableRepo::delete_key(&self.pool, key).await
    }

    // ========== Backup Operations ==========

    pub async fn create_backup(&self, device_id: i64, filename: &str, size: i64) -> Result<Backup> {
        settings::BackupRepo::create(&self.pool, device_id, filename, size).await
    }

    pub async fn list_backups(&self, device_id: i64) -> Result<Vec<Backup>> {
        settings::BackupRepo::list(&self.pool, device_id).await
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

    // ========== Device Model Operations ==========

    pub async fn list_device_models(&self) -> Result<Vec<DeviceModel>> {
        device_models::DeviceModelRepo::list(&self.pool).await
    }

    pub async fn get_device_model(&self, id: &str) -> Result<Option<DeviceModel>> {
        device_models::DeviceModelRepo::get(&self.pool, id).await
    }

    pub async fn create_device_model(&self, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        device_models::DeviceModelRepo::create(&self.pool, req).await
    }

    pub async fn update_device_model(&self, id: &str, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        device_models::DeviceModelRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_device_model(&self, id: &str) -> Result<()> {
        device_models::DeviceModelRepo::delete(&self.pool, id).await
    }

    // ========== Port Assignment Operations ==========

    pub async fn list_port_assignments(&self, device_id: i64) -> Result<Vec<PortAssignment>> {
        port_assignments::PortAssignmentRepo::list_for_device(&self.pool, device_id).await
    }

    pub async fn list_port_assignments_for_patch_panel(&self, pp_device_id: i64) -> Result<Vec<PortAssignment>> {
        port_assignments::PortAssignmentRepo::list_for_patch_panel(&self.pool, pp_device_id).await
    }

    pub async fn set_port_assignment(&self, device_id: i64, req: &SetPortAssignmentRequest) -> Result<PortAssignment> {
        port_assignments::PortAssignmentRepo::set(&self.pool, device_id, req).await
    }

    pub async fn bulk_set_port_assignments(&self, device_id: i64, assignments: &[SetPortAssignmentRequest]) -> Result<Vec<PortAssignment>> {
        port_assignments::PortAssignmentRepo::bulk_set(&self.pool, device_id, assignments).await
    }

    pub async fn delete_port_assignment(&self, device_id: i64, port_name: &str) -> Result<()> {
        port_assignments::PortAssignmentRepo::delete(&self.pool, device_id, port_name).await
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

    pub async fn get_vendor_action(&self, id: &str) -> Result<Option<VendorAction>> {
        vendor_actions::VendorActionRepo::get(&self.pool, id).await
    }

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

    pub async fn list_jobs_by_device(&self, device_id: i64, limit: i32) -> Result<Vec<Job>> {
        jobs::JobRepo::list_by_device(&self.pool, device_id, limit).await
    }

    pub async fn list_jobs_recent(&self, limit: i32) -> Result<Vec<Job>> {
        jobs::JobRepo::list_recent(&self.pool, limit).await
    }

    pub async fn list_jobs_stuck(&self) -> Result<Vec<Job>> {
        jobs::JobRepo::list_stuck(&self.pool).await
    }

    // ========== Job Template Operations ==========

    pub async fn list_job_templates(&self) -> Result<Vec<JobTemplate>> {
        job_templates::JobTemplateRepo::list(&self.pool).await
    }

    pub async fn get_job_template(&self, id: &str) -> Result<Option<JobTemplate>> {
        job_templates::JobTemplateRepo::get(&self.pool, id).await
    }

    pub async fn create_job_template(&self, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        job_templates::JobTemplateRepo::create(&self.pool, req).await
    }

    pub async fn update_job_template(&self, id: &str, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        job_templates::JobTemplateRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_job_template(&self, id: &str) -> Result<()> {
        job_templates::JobTemplateRepo::delete(&self.pool, id).await
    }

    pub async fn list_scheduled_job_templates(&self) -> Result<Vec<JobTemplate>> {
        job_templates::JobTemplateRepo::list_scheduled(&self.pool).await
    }

    pub async fn update_job_template_last_run(&self, id: &str) -> Result<()> {
        job_templates::JobTemplateRepo::update_last_run(&self.pool, id).await
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

    // ========== Group Operations ==========

    pub async fn list_groups(&self) -> Result<Vec<Group>> {
        groups::GroupRepo::list(&self.pool).await
    }

    pub async fn get_group(&self, id: &str) -> Result<Option<Group>> {
        groups::GroupRepo::get(&self.pool, id).await
    }

    pub async fn create_group(&self, req: &CreateGroupRequest) -> Result<Group> {
        groups::GroupRepo::create(&self.pool, req).await
    }

    pub async fn update_group(&self, id: &str, req: &CreateGroupRequest) -> Result<Group> {
        groups::GroupRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_group(&self, id: &str) -> Result<()> {
        groups::GroupRepo::delete(&self.pool, id).await
    }

    // ========== Group Variable Operations ==========

    pub async fn list_group_variables(&self, group_id: &str) -> Result<Vec<GroupVariable>> {
        groups::GroupRepo::list_variables(&self.pool, group_id).await
    }

    pub async fn set_group_variable(&self, group_id: &str, key: &str, value: &str) -> Result<()> {
        groups::GroupRepo::set_variable(&self.pool, group_id, key, value).await
    }

    pub async fn delete_group_variable(&self, group_id: &str, key: &str) -> Result<()> {
        groups::GroupRepo::delete_variable(&self.pool, group_id, key).await
    }

    // ========== Group Membership Operations ==========

    pub async fn list_group_members(&self, group_id: &str) -> Result<Vec<i64>> {
        groups::GroupRepo::list_group_members(&self.pool, group_id).await
    }

    pub async fn list_device_groups(&self, device_id: i64) -> Result<Vec<Group>> {
        groups::GroupRepo::list_device_groups(&self.pool, device_id).await
    }

    pub async fn add_device_to_group(&self, device_id: i64, group_id: &str) -> Result<()> {
        groups::GroupRepo::add_device_to_group(&self.pool, device_id, group_id).await
    }

    pub async fn remove_device_from_group(&self, device_id: i64, group_id: &str) -> Result<()> {
        groups::GroupRepo::remove_device_from_group(&self.pool, device_id, group_id).await
    }

    pub async fn set_group_members(&self, group_id: &str, device_ids: &[i64]) -> Result<()> {
        groups::GroupRepo::set_group_members(&self.pool, group_id, device_ids).await
    }

    pub async fn set_device_groups(&self, device_id: i64, group_ids: &[String]) -> Result<()> {
        groups::GroupRepo::set_device_groups(&self.pool, device_id, group_ids).await
    }

    // ========== Group Hierarchy ==========

    pub async fn get_group_children(&self, group_id: &str) -> Result<Vec<Group>> {
        groups::GroupRepo::get_children(&self.pool, group_id).await
    }

    pub async fn would_create_cycle(&self, group_id: &str, proposed_parent_id: &str) -> Result<bool> {
        groups::GroupRepo::would_create_cycle(&self.pool, group_id, proposed_parent_id).await
    }

    // ========== Variable Resolution ==========

    pub async fn resolve_device_variables(&self, device_id: i64) -> Result<ResolvedVariablesResponse> {
        variable_resolution::VariableResolver::resolve(&self.pool, device_id).await
    }

    pub async fn resolve_device_variables_flat(&self, device_id: i64) -> Result<HashMap<String, String>> {
        variable_resolution::VariableResolver::resolve_flat(&self.pool, device_id).await
    }

    // ========== Credential Operations ==========

    pub async fn list_credentials(&self) -> Result<Vec<Credential>> {
        credentials::CredentialRepo::list(&self.pool).await
    }

    pub async fn get_credential(&self, id: &str) -> Result<Option<Credential>> {
        credentials::CredentialRepo::get(&self.pool, id).await
    }

    pub async fn create_credential(&self, req: &CreateCredentialRequest) -> Result<Credential> {
        credentials::CredentialRepo::create(&self.pool, req).await
    }

    pub async fn update_credential(&self, id: &str, req: &CreateCredentialRequest) -> Result<Credential> {
        credentials::CredentialRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_credential(&self, id: &str) -> Result<()> {
        credentials::CredentialRepo::delete(&self.pool, id).await
    }

    // ========== Device Role Operations ==========

    pub async fn list_device_roles(&self) -> Result<Vec<DeviceRole>> {
        device_roles::DeviceRoleRepo::list(&self.pool).await
    }

    pub async fn get_device_role(&self, id: &str) -> Result<Option<DeviceRole>> {
        device_roles::DeviceRoleRepo::get(&self.pool, id).await
    }

    pub async fn create_device_role(&self, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        device_roles::DeviceRoleRepo::create(&self.pool, req).await
    }

    pub async fn update_device_role(&self, id: &str, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        device_roles::DeviceRoleRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_device_role(&self, id: &str) -> Result<()> {
        device_roles::DeviceRoleRepo::delete(&self.pool, id).await
    }

    // ========== Output Parser Operations ==========

    pub async fn list_output_parsers(&self) -> Result<Vec<OutputParser>> {
        output_parsers::OutputParserRepo::list(&self.pool).await
    }

    pub async fn get_output_parser(&self, id: i64) -> Result<Option<OutputParser>> {
        output_parsers::OutputParserRepo::get(&self.pool, id).await
    }

    pub async fn create_output_parser(&self, req: &CreateOutputParserRequest) -> Result<OutputParser> {
        output_parsers::OutputParserRepo::create(&self.pool, req).await
    }

    pub async fn update_output_parser(&self, id: i64, req: &CreateOutputParserRequest) -> Result<OutputParser> {
        output_parsers::OutputParserRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_output_parser(&self, id: i64) -> Result<()> {
        output_parsers::OutputParserRepo::delete(&self.pool, id).await
    }

    // ========== Ensure "all" group ==========

    async fn ensure_all_group(&self) -> Result<()> {
        let exists = groups::GroupRepo::get(&self.pool, "all").await?;
        if exists.is_none() {
            tracing::info!("Creating 'all' group");
            let req = CreateGroupRequest {
                id: "all".to_string(),
                name: "all".to_string(),
                description: Some("Default group — all devices inherit from this".to_string()),
                parent_id: None,
                precedence: 0,
            };
            groups::GroupRepo::create(&self.pool, &req).await?;
        }
        Ok(())
    }
}

// Re-export seed helpers for the API
pub use seeds::{get_default_dhcp_options_models, get_default_vendors_models};
