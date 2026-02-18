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
mod gpu_clusters;
mod tenants;
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
        self.resolve_vendor_default_templates().await?;
        self.seed_default_dhcp_options().await?;
        self.seed_default_user().await?;
        self.seed_default_vendor_actions().await?;
        self.seed_default_output_parsers().await?;
        self.seed_default_device_models().await?;
        self.seed_default_ipam_supernets().await?;
        self.seed_default_credential().await?;
        self.seed_default_device_roles().await?;
        self.seed_default_locations().await?;

        // Ensure "all" group invariants
        self.ensure_all_group().await?;
        self.seed_default_groups().await?;

        // Fix any devices that have vendor name strings instead of numeric IDs
        self.normalize_device_vendor_ids().await?;
        self.normalize_topology_roles().await?;

        Ok(())
    }

    /// Build a mapping from old text vendor IDs (e.g. "cisco", "arista") to new integer IDs.
    /// Uses the seed data to get old_id → name mapping, then looks up by name.
    async fn build_vendor_id_map(&self) -> Result<HashMap<String, i64>> {
        let mut map = HashMap::new();
        for (old_id, name, _, _, _, _, _, _, _, _) in seeds::seed_vendor_params() {
            let row: Option<(i64,)> = sqlx::query_as("SELECT id FROM vendors WHERE name = ?")
                .bind(&name)
                .fetch_optional(&self.pool)
                .await?;
            if let Some((vid,)) = row {
                map.insert(old_id, vid);
            }
        }
        Ok(map)
    }

    async fn seed_default_vendors(&self) -> Result<()> {
        for (_id, name, backup_command, deploy_command, diff_command, ssh_port, mac_json, vendor_class, default_template, group_names_json) in seeds::seed_vendor_params() {
            sqlx::query(
                r#"
                INSERT OR IGNORE INTO vendors (name, backup_command, deploy_command, diff_command, ssh_port, mac_prefixes, vendor_class, default_template, group_names, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE name = ?)
                "#,
            )
            .bind(&name)
            .bind(&backup_command)
            .bind(&deploy_command)
            .bind(&diff_command)
            .bind(ssh_port)
            .bind(&mac_json)
            .bind(&vendor_class)
            .bind(&default_template)
            .bind(&group_names_json)
            .bind(&name)
            .execute(&self.pool)
            .await?;

            // Update group_names on existing vendors if still empty
            if group_names_json != "[]" {
                sqlx::query("UPDATE vendors SET group_names = ? WHERE name = ? AND (group_names IS NULL OR group_names = '[]')")
                    .bind(&group_names_json)
                    .bind(&name)
                    .execute(&self.pool)
                    .await?;
            }
        }
        Ok(())
    }

    async fn seed_default_templates(&self) -> Result<()> {
        // Build a mapping from old text vendor IDs to new integer IDs
        let vendor_map = self.build_vendor_id_map().await?;

        for (id, name, description, vendor_id, content) in seeds::seed_template_params() {
            // Role templates (spine/leaf) use UPDATE-or-INSERT so they stay
            // in sync with updated variable-based templates across upgrades.
            // Base templates use INSERT with NOT EXISTS so user edits are preserved.
            let vendor_id_val: Option<i64> = if vendor_id.is_empty() {
                None
            } else {
                vendor_map.get(&vendor_id).copied()
            };

            if seeds::is_role_template(&id) {
                // Update existing role template, or insert if missing
                let updated = sqlx::query(
                    "UPDATE templates SET description = ?, vendor_id = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?"
                )
                .bind(&description)
                .bind(&vendor_id_val)
                .bind(&content)
                .bind(&name)
                .execute(&self.pool)
                .await?;

                if updated.rows_affected() == 0 {
                    sqlx::query(
                        r#"
                        INSERT INTO templates (name, description, vendor_id, content, created_at, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        "#,
                    )
                    .bind(&name)
                    .bind(&description)
                    .bind(&vendor_id_val)
                    .bind(&content)
                    .execute(&self.pool)
                    .await?;
                }
            } else {
                sqlx::query(
                    r#"
                    INSERT INTO templates (name, description, vendor_id, content, created_at, updated_at)
                    SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    WHERE NOT EXISTS (SELECT 1 FROM templates WHERE name = ?)
                    "#,
                )
                .bind(&name)
                .bind(&description)
                .bind(&vendor_id_val)
                .bind(&content)
                .bind(&name)
                .execute(&self.pool)
                .await?;
            }
        }
        Ok(())
    }

    /// Resolve vendor default_template from text seed IDs (e.g. "arista-eos") to integer template IDs.
    /// Runs after both vendors and templates are seeded.
    async fn resolve_vendor_default_templates(&self) -> Result<()> {
        // Build mapping from seed text ID → template name
        let template_id_to_name: HashMap<String, String> = seeds::seed_template_params()
            .into_iter()
            .map(|(id, name, _, _, _)| (id, name))
            .collect();

        for (_id, _name, _, _, _, _, _, _, default_template, _) in seeds::seed_vendor_params() {
            if default_template.is_empty() {
                continue;
            }
            // Already an integer ID? Skip.
            if default_template.parse::<i64>().is_ok() {
                continue;
            }
            // Look up the template name from the seed ID
            if let Some(template_name) = template_id_to_name.get(&default_template) {
                let tid: Option<(i64,)> = sqlx::query_as("SELECT id FROM templates WHERE name = ?")
                    .bind(template_name)
                    .fetch_optional(&self.pool)
                    .await?;
                if let Some((template_id,)) = tid {
                    sqlx::query("UPDATE vendors SET default_template = ? WHERE default_template = ?")
                        .bind(template_id.to_string())
                        .bind(&default_template)
                        .execute(&self.pool)
                        .await?;
                }
            }
        }
        Ok(())
    }

    async fn seed_default_dhcp_options(&self) -> Result<()> {
        let vendor_map = self.build_vendor_id_map().await?;

        for (_id, option_number, name, value, option_type, vendor_id, description, enabled) in seeds::seed_dhcp_option_params() {
            let vendor_id_val: Option<i64> = if vendor_id.is_empty() {
                None
            } else {
                vendor_map.get(&vendor_id).copied()
            };

            sqlx::query(
                r#"
                INSERT INTO dhcp_options (option_number, name, value, type, vendor_id, description, enabled, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM dhcp_options WHERE option_number = ? AND name = ?)
                "#,
            )
            .bind(option_number)
            .bind(&name)
            .bind(&value)
            .bind(&option_type)
            .bind(&vendor_id_val)
            .bind(&description)
            .bind(enabled)
            .bind(option_number)
            .bind(&name)
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
            let password_hash = bcrypt::hash("admin", bcrypt::DEFAULT_COST)
                .map_err(|e| anyhow::anyhow!("Failed to hash default password: {}", e))?;

            self.create_user("admin", &password_hash).await?;
            tracing::info!("Created default admin user (username: admin, password: admin)");
        }

        Ok(())
    }

    async fn seed_default_vendor_actions(&self) -> Result<()> {
        let vendor_map = self.build_vendor_id_map().await?;

        for (_id, vendor_id, label, command, sort_order, action_type, webhook_url, webhook_method, webhook_headers, webhook_body) in seeds::seed_vendor_action_params() {
            let vendor_id_val: Option<i64> = vendor_map.get(&vendor_id).copied();
            if vendor_id_val.is_none() {
                continue; // Skip actions for unknown vendors
            }
            let vid = vendor_id_val.unwrap();

            sqlx::query(
                r#"
                INSERT INTO vendor_actions (vendor_id, label, command, sort_order, action_type, webhook_url, webhook_method, webhook_headers, webhook_body, created_at)
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM vendor_actions WHERE vendor_id = ? AND label = ?)
                "#,
            )
            .bind(vid)
            .bind(&label)
            .bind(&command)
            .bind(sort_order)
            .bind(&action_type)
            .bind(&webhook_url)
            .bind(&webhook_method)
            .bind(&webhook_headers)
            .bind(&webhook_body)
            .bind(vid)
            .bind(&label)
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

            // Link the parser to its vendor action by label match (since action IDs are now integers)
            // The old action_id was a text slug like "arista-show-ip-int-brief"
            // We match by looking up the action label from the seed data
            if let Some(action_label) = seeds::action_id_to_label(parser.action_id) {
                sqlx::query(
                    r#"
                    UPDATE vendor_actions
                    SET output_parser_id = (SELECT id FROM output_parsers WHERE name = ?)
                    WHERE label = ? AND output_parser_id IS NULL
                    "#,
                )
                .bind(parser.name)
                .bind(action_label)
                .execute(&self.pool)
                .await?;
            }
        }
        Ok(())
    }

    async fn seed_default_device_models(&self) -> Result<()> {
        let vendor_map = self.build_vendor_id_map().await?;

        for (_id, vendor_id, model, display_name, rack_units, layout) in seeds::seed_device_model_params() {
            let vendor_id_val = match vendor_map.get(&vendor_id) {
                Some(&vid) => vid,
                None => continue, // Skip models for unknown vendors
            };

            sqlx::query(
                r#"
                INSERT INTO device_models (vendor_id, model, display_name, rack_units, layout, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                WHERE NOT EXISTS (SELECT 1 FROM device_models WHERE vendor_id = ? AND model = ?)
                "#,
            )
            .bind(vendor_id_val)
            .bind(&model)
            .bind(&display_name)
            .bind(rack_units)
            .bind(&layout)
            .bind(vendor_id_val)
            .bind(&model)
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

    async fn seed_default_credential(&self) -> Result<()> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM credentials WHERE name = 'admin'")
            .fetch_one(&self.pool)
            .await?;
        if count.0 == 0 {
            sqlx::query(
                r#"INSERT INTO credentials (name, description, cred_type, username, password, created_at, updated_at)
                   VALUES ('admin', 'Default admin credential', 'ssh', 'admin', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            )
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }

    async fn seed_default_device_roles(&self) -> Result<()> {
        // Device roles: (name, description, template_names, group_names)
        let roles: Vec<(&str, &str, Vec<&str>, Vec<&str>)> = vec![
            // CLOS roles
            ("super-spine", "Super-spine role for multi-stage CLOS fabric", vec![], vec!["super-spine"]),
            ("spine", "Spine role for CLOS fabric", vec!["Arista EOS Spine", "FRR BGP Spine"], vec!["spine"]),
            ("leaf", "Leaf role for CLOS fabric", vec!["Arista EOS Leaf", "FRR BGP Leaf"], vec!["leaf"]),
            // Hierarchical (3-tier) roles
            ("core", "Core router role for hierarchical fabric", vec!["Arista EOS Core", "FRR BGP Core"], vec!["core"]),
            ("distribution", "Distribution switch role for hierarchical fabric", vec!["Arista EOS Distribution", "FRR BGP Distribution"], vec!["distribution"]),
            ("access", "Access switch role for hierarchical fabric", vec!["Arista EOS Access", "FRR BGP Access"], vec!["access"]),
        ];

        for (name, description, template_names, group_names) in &roles {
            let group_names_json = serde_json::to_string(group_names).unwrap_or_else(|_| "[]".to_string());

            let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM device_roles WHERE name = ?")
                .bind(name)
                .fetch_one(&self.pool)
                .await?;
            if count.0 > 0 {
                // Update group_names on existing roles to ensure they stay in sync
                sqlx::query("UPDATE device_roles SET group_names = ? WHERE name = ? AND group_names = '[]'")
                    .bind(&group_names_json)
                    .bind(name)
                    .execute(&self.pool)
                    .await?;
                continue;
            }

            let result = sqlx::query(
                "INSERT INTO device_roles (name, description, group_names, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
            .bind(name)
            .bind(description)
            .bind(&group_names_json)
            .execute(&self.pool)
            .await?;

            let role_id = result.last_insert_rowid();

            // Link templates by name
            for (i, tname) in template_names.iter().enumerate() {
                let tid: Option<(i64,)> = sqlx::query_as("SELECT id FROM templates WHERE name = ?")
                    .bind(tname)
                    .fetch_optional(&self.pool)
                    .await?;
                if let Some((template_id,)) = tid {
                    sqlx::query(
                        "INSERT INTO device_role_templates (role_id, template_id, sort_order) VALUES (?, ?, ?)"
                    )
                    .bind(role_id)
                    .bind(template_id)
                    .bind(i as i32)
                    .execute(&self.pool)
                    .await?;
                }
            }
        }
        Ok(())
    }

    async fn seed_default_locations(&self) -> Result<()> {
        // Region: us-west
        let region_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ipam_regions WHERE name = 'us-west'")
            .fetch_one(&self.pool).await?;
        if region_count.0 > 0 {
            return Ok(());
        }

        let region = sqlx::query(
            "INSERT INTO ipam_regions (name, description, created_at, updated_at) VALUES ('us-west', 'US West region', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ).execute(&self.pool).await?;
        let region_id = region.last_insert_rowid();

        // Campus: camp1
        let campus = sqlx::query(
            "INSERT INTO ipam_locations (name, description, region_id, created_at, updated_at) VALUES ('camp1', 'Campus 1', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ).bind(region_id).execute(&self.pool).await?;
        let campus_id = campus.last_insert_rowid();

        // Datacenter: las (Las Vegas)
        sqlx::query(
            "INSERT INTO ipam_datacenters (name, description, location_id, created_at, updated_at) VALUES ('las', 'Las Vegas', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ).bind(campus_id).execute(&self.pool).await?;

        Ok(())
    }

    // ========== User Operations ==========

    pub async fn list_users(&self) -> Result<Vec<User>> {
        users::UserRepo::list(&self.pool).await
    }

    pub async fn get_user(&self, id: i64) -> Result<Option<User>> {
        users::UserRepo::get(&self.pool, id).await
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        users::UserRepo::get_by_username(&self.pool, username).await
    }

    pub async fn create_user(&self, username: &str, password_hash: &str) -> Result<()> {
        users::UserRepo::create(&self.pool, username, password_hash).await
    }

    pub async fn create_user_full(&self, req: &CreateUserRequest) -> Result<User> {
        users::UserRepo::create_full(&self.pool, req).await
    }

    pub async fn update_user(&self, id: i64, req: &UpdateUserRequest) -> Result<User> {
        users::UserRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_user(&self, id: i64) -> Result<()> {
        users::UserRepo::delete(&self.pool, id).await
    }

    // ========== Device Operations ==========

    pub async fn list_hostnames_matching(&self, pattern: &str) -> Result<Vec<String>> {
        let rows: Vec<String> = sqlx::query_scalar(
            "SELECT hostname FROM devices WHERE hostname LIKE ?",
        )
        .bind(pattern)
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

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

    pub async fn delete_devices_by_topology(&self, topology_id: i64) -> Result<u64> {
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

    pub async fn get_vendor(&self, id: i64) -> Result<Option<Vendor>> {
        vendors::VendorRepo::get(&self.pool, id).await
    }

    pub async fn get_vendor_by_name(&self, name: &str) -> Result<Option<Vendor>> {
        vendors::VendorRepo::get_by_name(&self.pool, name).await
    }

    /// Resolve a vendor from either an integer ID string or a name (case-insensitive)
    pub async fn resolve_vendor(&self, vendor_str: &str) -> Result<Option<Vendor>> {
        if let Ok(id) = vendor_str.parse::<i64>() {
            self.get_vendor(id).await
        } else {
            self.get_vendor_by_name(vendor_str).await
        }
    }

    pub async fn create_vendor(&self, req: &CreateVendorRequest) -> Result<Vendor> {
        vendors::VendorRepo::create(&self.pool, req).await
    }

    pub async fn update_vendor(&self, id: i64, req: &CreateVendorRequest) -> Result<Vendor> {
        vendors::VendorRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_vendor(&self, id: i64) -> Result<()> {
        vendors::VendorRepo::delete(&self.pool, id).await
    }

    // ========== Device Model Operations ==========

    pub async fn list_device_models(&self) -> Result<Vec<DeviceModel>> {
        device_models::DeviceModelRepo::list(&self.pool).await
    }

    pub async fn get_device_model(&self, id: i64) -> Result<Option<DeviceModel>> {
        device_models::DeviceModelRepo::get(&self.pool, id).await
    }

    pub async fn create_device_model(&self, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        device_models::DeviceModelRepo::create(&self.pool, req).await
    }

    pub async fn update_device_model(&self, id: i64, req: &CreateDeviceModelRequest) -> Result<DeviceModel> {
        device_models::DeviceModelRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_device_model(&self, id: i64) -> Result<()> {
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

    pub async fn get_dhcp_option(&self, id: i64) -> Result<Option<DhcpOption>> {
        dhcp_options::DhcpOptionRepo::get(&self.pool, id).await
    }

    pub async fn create_dhcp_option(&self, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        dhcp_options::DhcpOptionRepo::create(&self.pool, req).await
    }

    pub async fn update_dhcp_option(&self, id: i64, req: &CreateDhcpOptionRequest) -> Result<DhcpOption> {
        dhcp_options::DhcpOptionRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_dhcp_option(&self, id: i64) -> Result<()> {
        dhcp_options::DhcpOptionRepo::delete(&self.pool, id).await
    }

    // ========== Template Operations ==========

    pub async fn list_templates(&self) -> Result<Vec<Template>> {
        templates::TemplateRepo::list(&self.pool).await
    }

    pub async fn get_template(&self, id: i64) -> Result<Option<Template>> {
        templates::TemplateRepo::get(&self.pool, id).await
    }

    pub async fn get_template_by_name(&self, name: &str) -> Result<Option<Template>> {
        templates::TemplateRepo::get_by_name(&self.pool, name).await
    }

    pub async fn create_template(&self, req: &CreateTemplateRequest) -> Result<Template> {
        templates::TemplateRepo::create(&self.pool, req).await
    }

    pub async fn update_template(&self, id: i64, req: &CreateTemplateRequest) -> Result<Template> {
        templates::TemplateRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_template(&self, id: i64) -> Result<()> {
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

    pub async fn get_vendor_action(&self, id: i64) -> Result<Option<VendorAction>> {
        vendor_actions::VendorActionRepo::get(&self.pool, id).await
    }

    pub async fn list_vendor_actions(&self) -> Result<Vec<VendorAction>> {
        vendor_actions::VendorActionRepo::list_all(&self.pool).await
    }

    pub async fn list_vendor_actions_by_vendor(&self, vendor_id: i64) -> Result<Vec<VendorAction>> {
        vendor_actions::VendorActionRepo::list_by_vendor(&self.pool, vendor_id).await
    }

    pub async fn create_vendor_action(&self, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        vendor_actions::VendorActionRepo::create(&self.pool, req).await
    }

    pub async fn update_vendor_action(&self, id: i64, req: &CreateVendorActionRequest) -> Result<VendorAction> {
        vendor_actions::VendorActionRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_vendor_action(&self, id: i64) -> Result<()> {
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

    pub async fn get_job_template(&self, id: i64) -> Result<Option<JobTemplate>> {
        job_templates::JobTemplateRepo::get(&self.pool, id).await
    }

    pub async fn create_job_template(&self, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        job_templates::JobTemplateRepo::create(&self.pool, req).await
    }

    pub async fn update_job_template(&self, id: i64, req: &CreateJobTemplateRequest) -> Result<JobTemplate> {
        job_templates::JobTemplateRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_job_template(&self, id: i64) -> Result<()> {
        job_templates::JobTemplateRepo::delete(&self.pool, id).await
    }

    pub async fn list_scheduled_job_templates(&self) -> Result<Vec<JobTemplate>> {
        job_templates::JobTemplateRepo::list_scheduled(&self.pool).await
    }

    pub async fn update_job_template_last_run(&self, id: i64) -> Result<()> {
        job_templates::JobTemplateRepo::update_last_run(&self.pool, id).await
    }

    // ========== Topology Operations ==========

    pub async fn list_topologies(&self) -> Result<Vec<Topology>> {
        topologies::TopologyRepo::list(&self.pool).await
    }

    pub async fn get_topology(&self, id: i64) -> Result<Option<Topology>> {
        topologies::TopologyRepo::get(&self.pool, id).await
    }

    pub async fn create_topology(&self, req: &CreateTopologyRequest) -> Result<Topology> {
        topologies::TopologyRepo::create(&self.pool, req).await
    }

    pub async fn update_topology(&self, id: i64, req: &CreateTopologyRequest) -> Result<Topology> {
        topologies::TopologyRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_topology(&self, id: i64) -> Result<()> {
        topologies::TopologyRepo::delete(&self.pool, id).await
    }

    pub async fn delete_topology_by_name(&self, name: &str) -> Result<()> {
        let topos = self.list_topologies().await?;
        if let Some(t) = topos.iter().find(|t| t.name == name) {
            self.delete_topology(t.id).await?;
        }
        Ok(())
    }

    // ========== Group Operations ==========

    pub async fn list_groups(&self) -> Result<Vec<Group>> {
        groups::GroupRepo::list(&self.pool).await
    }

    pub async fn get_group(&self, id: i64) -> Result<Option<Group>> {
        groups::GroupRepo::get(&self.pool, id).await
    }

    pub async fn get_group_by_name(&self, name: &str) -> Result<Option<Group>> {
        groups::GroupRepo::get_by_name(&self.pool, name).await
    }

    pub async fn create_group(&self, req: &CreateGroupRequest) -> Result<Group> {
        groups::GroupRepo::create(&self.pool, req).await
    }

    pub async fn update_group(&self, id: i64, req: &CreateGroupRequest) -> Result<Group> {
        groups::GroupRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_group(&self, id: i64) -> Result<()> {
        groups::GroupRepo::delete(&self.pool, id).await
    }

    // ========== Group Variable Operations ==========

    pub async fn list_group_variables(&self, group_id: i64) -> Result<Vec<GroupVariable>> {
        groups::GroupRepo::list_variables(&self.pool, group_id).await
    }

    pub async fn set_group_variable(&self, group_id: i64, key: &str, value: &str) -> Result<()> {
        groups::GroupRepo::set_variable(&self.pool, group_id, key, value).await
    }

    pub async fn delete_group_variable(&self, group_id: i64, key: &str) -> Result<()> {
        groups::GroupRepo::delete_variable(&self.pool, group_id, key).await
    }

    // ========== Group Membership Operations ==========

    pub async fn list_group_members(&self, group_id: i64) -> Result<Vec<i64>> {
        groups::GroupRepo::list_group_members(&self.pool, group_id).await
    }

    pub async fn list_device_groups(&self, device_id: i64) -> Result<Vec<Group>> {
        groups::GroupRepo::list_device_groups(&self.pool, device_id).await
    }

    pub async fn add_device_to_group(&self, device_id: i64, group_id: i64) -> Result<()> {
        groups::GroupRepo::add_device_to_group(&self.pool, device_id, group_id).await
    }

    pub async fn remove_device_from_group(&self, device_id: i64, group_id: i64) -> Result<()> {
        groups::GroupRepo::remove_device_from_group(&self.pool, device_id, group_id).await
    }

    pub async fn set_group_members(&self, group_id: i64, device_ids: &[i64]) -> Result<()> {
        groups::GroupRepo::set_group_members(&self.pool, group_id, device_ids).await
    }

    pub async fn set_device_groups(&self, device_id: i64, group_ids: &[i64]) -> Result<()> {
        groups::GroupRepo::set_device_groups(&self.pool, device_id, group_ids).await
    }

    // ========== Group Hierarchy ==========

    pub async fn get_group_children(&self, group_id: i64) -> Result<Vec<Group>> {
        groups::GroupRepo::get_children(&self.pool, group_id).await
    }

    pub async fn would_create_cycle(&self, group_id: i64, proposed_parent_id: i64) -> Result<bool> {
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

    pub async fn get_credential(&self, id: i64) -> Result<Option<Credential>> {
        credentials::CredentialRepo::get(&self.pool, id).await
    }

    pub async fn create_credential(&self, req: &CreateCredentialRequest) -> Result<Credential> {
        credentials::CredentialRepo::create(&self.pool, req).await
    }

    pub async fn update_credential(&self, id: i64, req: &CreateCredentialRequest) -> Result<Credential> {
        credentials::CredentialRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_credential(&self, id: i64) -> Result<()> {
        credentials::CredentialRepo::delete(&self.pool, id).await
    }

    // ========== Device Role Operations ==========

    pub async fn list_device_roles(&self) -> Result<Vec<DeviceRole>> {
        device_roles::DeviceRoleRepo::list(&self.pool).await
    }

    pub async fn get_device_role(&self, id: i64) -> Result<Option<DeviceRole>> {
        device_roles::DeviceRoleRepo::get(&self.pool, id).await
    }

    pub async fn find_device_role_by_name(&self, name: &str) -> Result<Option<DeviceRole>> {
        device_roles::DeviceRoleRepo::find_by_name(&self.pool, name).await
    }

    pub async fn create_device_role(&self, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        device_roles::DeviceRoleRepo::create(&self.pool, req).await
    }

    pub async fn update_device_role(&self, id: i64, req: &CreateDeviceRoleRequest) -> Result<DeviceRole> {
        device_roles::DeviceRoleRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_device_role(&self, id: i64) -> Result<()> {
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

    // ========== GPU Cluster Operations ==========

    pub async fn list_gpu_clusters(&self) -> Result<Vec<GpuCluster>> {
        gpu_clusters::GpuClusterRepo::list(&self.pool).await
    }

    pub async fn get_gpu_cluster(&self, id: i64) -> Result<Option<GpuCluster>> {
        gpu_clusters::GpuClusterRepo::get(&self.pool, id).await
    }

    pub async fn create_gpu_cluster(&self, req: &CreateGpuClusterRequest) -> Result<GpuCluster> {
        gpu_clusters::GpuClusterRepo::create(&self.pool, req).await
    }

    pub async fn update_gpu_cluster(&self, id: i64, req: &CreateGpuClusterRequest) -> Result<GpuCluster> {
        gpu_clusters::GpuClusterRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_gpu_cluster(&self, id: i64) -> Result<()> {
        gpu_clusters::GpuClusterRepo::delete(&self.pool, id).await
    }

    // ========== Tenant Operations ==========

    pub async fn list_tenants(&self) -> Result<Vec<Tenant>> {
        tenants::TenantRepo::list(&self.pool).await
    }

    pub async fn get_tenant(&self, id: i64) -> Result<Option<Tenant>> {
        tenants::TenantRepo::get(&self.pool, id).await
    }

    pub async fn create_tenant(&self, req: &CreateTenantRequest) -> Result<Tenant> {
        tenants::TenantRepo::create(&self.pool, req).await
    }

    pub async fn update_tenant(&self, id: i64, req: &CreateTenantRequest) -> Result<Tenant> {
        tenants::TenantRepo::update(&self.pool, id, req).await
    }

    pub async fn delete_tenant(&self, id: i64) -> Result<()> {
        tenants::TenantRepo::delete(&self.pool, id).await
    }

    // ========== Ensure "all" group ==========

    async fn ensure_all_group(&self) -> Result<()> {
        let exists = groups::GroupRepo::get(&self.pool, 1).await?;
        if exists.is_none() {
            tracing::info!("Creating 'all' group");
            let req = CreateGroupRequest {
                name: "all".to_string(),
                description: Some("Default group — all devices inherit from this".to_string()),
                parent_id: None,
                precedence: 0,
            };
            groups::GroupRepo::create(&self.pool, &req).await?;
        }
        Ok(())
    }

    async fn seed_default_groups(&self) -> Result<()> {
        let default_groups: Vec<(&str, &str, i32)> = vec![
            ("super-spine", "Super-spine switches", 5),
            ("spine", "Spine switches", 10),
            ("leaf", "Leaf switches", 20),
            ("core", "Core routers", 25),
            ("distribution", "Distribution switches", 26),
            ("access", "Access switches", 27),
            ("arista", "Arista devices", 30),
            ("amd", "AMD devices", 40),
        ];

        for (name, description, precedence) in default_groups {
            let existing = groups::GroupRepo::get_by_name(&self.pool, name).await?;
            if existing.is_none() {
                tracing::info!("Creating default group: {}", name);
                let req = CreateGroupRequest {
                    name: name.to_string(),
                    description: Some(description.to_string()),
                    parent_id: None,
                    precedence,
                };
                groups::GroupRepo::create(&self.pool, &req).await?;
            }
        }
        Ok(())
    }

    /// Convert any devices that store a vendor name string (e.g. "amd", "patch-panel")
    /// in the vendor column to the numeric vendor ID instead.
    async fn normalize_device_vendor_ids(&self) -> Result<()> {
        let rows: Vec<(i64, String)> = sqlx::query_as(
            "SELECT id, vendor FROM devices WHERE vendor != '' AND vendor IS NOT NULL"
        )
        .fetch_all(&self.pool)
        .await?;

        for (device_id, vendor_val) in &rows {
            // Skip if already a numeric ID
            if vendor_val.parse::<i64>().is_ok() {
                continue;
            }
            // Look up vendor by name (case-insensitive), also try replacing hyphens with spaces
            let candidates = vec![
                vendor_val.clone(),
                vendor_val.replace('-', " "),
            ];
            let mut found = false;
            for candidate in &candidates {
                if let Ok(Some(vendor)) = self.get_vendor_by_name(candidate).await {
                    sqlx::query("UPDATE devices SET vendor = ? WHERE id = ?")
                        .bind(vendor.id.to_string())
                        .bind(device_id)
                        .execute(&self.pool)
                        .await?;
                    tracing::info!("Normalized device {} vendor '{}' -> '{}'", device_id, vendor_val, vendor.id);
                    found = true;
                    break;
                }
            }
            if !found {
                tracing::warn!("Could not resolve vendor '{}' for device {}", vendor_val, device_id);
            }
        }
        Ok(())
    }

    /// Normalize topology_role values: convert hyphenated forms to space-separated
    async fn normalize_topology_roles(&self) -> Result<()> {
        let result = sqlx::query(
            "UPDATE devices SET topology_role = REPLACE(topology_role, '-', ' ') WHERE topology_role LIKE '%-%'"
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            tracing::info!("Normalized {} device topology_role values (removed hyphens)", result.rows_affected());
        }
        Ok(())
    }
}

// Re-export seed helpers for the API
pub use seeds::{get_default_dhcp_options_models, get_default_vendors_models};
