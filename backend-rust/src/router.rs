use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

use crate::handlers;
use crate::AppState;

/// Build the application router with all routes
pub fn build(state: Arc<AppState>, frontend_dir: &str) -> Router {
    Router::new()
        // Benchmark routes
        .route("/api/benchmark", get(handlers::benchmarks::benchmark_handler))
        .route("/api/mandelbrot", get(handlers::benchmarks::mandelbrot_handler))
        .route("/api/json-bench", get(handlers::benchmarks::json_bench_handler))
        .route("/api/template-simple", get(handlers::benchmarks::template_simple_handler))
        .route("/api/template-large", get(handlers::benchmarks::template_large_handler))
        .route("/api/template-acl", get(handlers::benchmarks::template_acl_handler))
        .route("/api/template-acl10k", get(handlers::benchmarks::template_acl10k_handler))
        // Device routes
        .route("/api/devices", get(handlers::devices::list_devices))
        .route("/api/devices", post(handlers::devices::create_device))
        .route("/api/devices/:mac", get(handlers::devices::get_device))
        .route("/api/devices/:mac", put(handlers::devices::update_device))
        .route("/api/devices/:mac", delete(handlers::devices::delete_device))
        .route("/api/devices/:mac/connect", post(handlers::devices::connect_device))
        .route("/api/devices/:mac/config", get(handlers::devices::get_device_config))
        .route("/api/devices/:mac/preview-config", post(handlers::devices::preview_device_config))
        .route("/api/devices/:mac/deploy-config", post(handlers::devices::deploy_device_config))
        // Backup routes
        .route("/api/devices/:mac/backup", post(handlers::backups::trigger_backup))
        .route("/api/devices/:mac/backups", get(handlers::backups::list_backups))
        .route("/api/backups/:id", get(handlers::backups::get_backup))
        // Settings routes
        .route("/api/settings", get(handlers::settings::get_settings))
        .route("/api/settings", put(handlers::settings::update_settings))
        .route("/api/reload", post(handlers::settings::reload_config))
        .route("/api/network/addresses", get(handlers::settings::get_local_addresses))
        // Vendor routes
        .route("/api/vendors", get(handlers::vendors::list_vendors))
        .route("/api/vendors", post(handlers::vendors::create_vendor))
        .route("/api/vendors/defaults", get(handlers::vendors::get_default_vendors))
        .route("/api/vendors/:id", get(handlers::vendors::get_vendor))
        .route("/api/vendors/:id", put(handlers::vendors::update_vendor))
        .route("/api/vendors/:id", delete(handlers::vendors::delete_vendor))
        // Template routes
        .route("/api/templates", get(handlers::templates::list_templates))
        .route("/api/templates", post(handlers::templates::create_template))
        .route("/api/templates/_/variables", get(handlers::templates::get_template_variables))
        .route("/api/templates/:id", get(handlers::templates::get_template))
        .route("/api/templates/:id", put(handlers::templates::update_template))
        .route("/api/templates/:id", delete(handlers::templates::delete_template))
        .route("/api/templates/:id/preview", post(handlers::templates::preview_template))
        // DHCP Option routes
        .route("/api/dhcp-options", get(handlers::dhcp_options::list_dhcp_options))
        .route("/api/dhcp-options", post(handlers::dhcp_options::create_dhcp_option))
        .route("/api/dhcp-options/defaults", get(handlers::dhcp_options::get_default_dhcp_options))
        .route("/api/dhcp-options/:id", get(handlers::dhcp_options::get_dhcp_option))
        .route("/api/dhcp-options/:id", put(handlers::dhcp_options::update_dhcp_option))
        .route("/api/dhcp-options/:id", delete(handlers::dhcp_options::delete_dhcp_option))
        // Discovery routes
        .route("/api/discovery", get(handlers::discovery::list_undiscovered))
        .route("/api/discovery/leases", get(handlers::discovery::list_leases))
        .route("/api/discovery/logs", get(handlers::discovery::list_discovery_logs))
        .route("/api/discovery/logs", delete(handlers::discovery::clear_discovery_logs))
        .route("/api/discovery/clear", post(handlers::discovery::clear_discovery))
        .route("/api/discovery/:mac", delete(handlers::discovery::dismiss_discovered_device))
        // NetBox routes
        .route("/api/netbox/status", get(handlers::netbox::get_status))
        .route("/api/netbox/config", get(handlers::netbox::get_config))
        .route("/api/netbox/config", put(handlers::netbox::update_config))
        .route("/api/netbox/sync/push", post(handlers::netbox::sync_push))
        .route("/api/netbox/sync/pull", post(handlers::netbox::sync_pull))
        .route("/api/netbox/sync/vendors/push", post(handlers::netbox::sync_vendors_push))
        .route("/api/netbox/sync/vendors/pull", post(handlers::netbox::sync_vendors_pull))
        .route("/api/netbox/manufacturers", get(handlers::netbox::get_manufacturers))
        .route("/api/netbox/sites", get(handlers::netbox::get_sites))
        .route("/api/netbox/device-roles", get(handlers::netbox::get_device_roles))
        // Generic connectivity test (by IP, for discovery/containers)
        .route("/api/connect", post(handlers::devices::connect_ip))
        // Docker container management routes
        .route("/api/docker/containers", get(handlers::docker::list_containers))
        .route("/api/docker/containers", post(handlers::docker::spawn_container))
        .route("/api/docker/containers/:id", delete(handlers::docker::remove_container))
        .route("/api/docker/containers/:id/restart", post(handlers::docker::restart_container))
        // WebSocket route
        .route("/api/ws", get(crate::ws_upgrade_handler))
        // Config server route
        .route("/configs/:filename", get(handlers::configs::serve_config))
        // Static files (frontend)
        .nest_service("/assets", ServeDir::new(format!("{}/assets", frontend_dir)))
        .fallback_service(ServeDir::new(frontend_dir).fallback(
            tower_http::services::ServeFile::new(format!("{}/index.html", frontend_dir)),
        ))
        // Add state and middleware
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
}
