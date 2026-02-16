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
        // Public routes
        .route("/api/health", get(handlers::healthcheck))
        .route("/api/auth/login", post(handlers::auth::login))
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
        .route("/api/devices/next-hostname", get(handlers::devices::next_hostname))
        .route("/api/devices/:id", get(handlers::devices::get_device))
        .route("/api/devices/:id", put(handlers::devices::update_device))
        .route("/api/devices/:id", delete(handlers::devices::delete_device))
        .route("/api/devices/:id/connect", post(handlers::devices::connect_device))
        .route("/api/devices/:id/config", get(handlers::devices::get_device_config))
        .route("/api/devices/:id/preview-config", post(handlers::devices::preview_device_config))
        .route("/api/devices/:id/deploy-config", post(handlers::devices::deploy_device_config))
        .route("/api/devices/:id/diff-config", post(handlers::devices::diff_device_config))
        .route("/api/devices/:id/exec", post(handlers::devices::exec_command))
        // Job routes
        .route("/api/jobs", get(handlers::jobs::list_jobs))
        .route("/api/jobs/:id", get(handlers::jobs::get_job))
        // Job template routes
        .route("/api/job-templates", get(handlers::job_templates::list_job_templates))
        .route("/api/job-templates", post(handlers::job_templates::create_job_template))
        .route("/api/job-templates/:id", get(handlers::job_templates::get_job_template))
        .route("/api/job-templates/:id", put(handlers::job_templates::update_job_template))
        .route("/api/job-templates/:id", delete(handlers::job_templates::delete_job_template))
        .route("/api/job-templates/:id/run", post(handlers::job_templates::run_job_template))
        // Device variable routes
        .route("/api/devices/:id/variables", get(handlers::device_variables::list_device_variables))
        .route("/api/devices/:id/variables", put(handlers::device_variables::set_device_variables))
        .route("/api/devices/:id/variables/:key", put(handlers::device_variables::set_device_variable))
        .route("/api/devices/:id/variables/:key", delete(handlers::device_variables::delete_device_variable))
        .route("/api/variables/keys", get(handlers::device_variables::list_variable_keys))
        .route("/api/variables/keys/:key", delete(handlers::device_variables::delete_variable_key))
        .route("/api/variables/by-key/:key", get(handlers::device_variables::list_by_key))
        .route("/api/variables/bulk", post(handlers::device_variables::bulk_set_variables))
        // Port assignment routes
        .route("/api/devices/:id/port-assignments", get(handlers::port_assignments::list_port_assignments))
        .route("/api/devices/:id/port-assignments", put(handlers::port_assignments::bulk_set_port_assignments))
        .route("/api/devices/:id/port-assignments/:port_name", put(handlers::port_assignments::set_port_assignment))
        .route("/api/devices/:id/port-assignments/:port_name", delete(handlers::port_assignments::delete_port_assignment))
        // Backup routes
        .route("/api/devices/:id/backup", post(handlers::backups::trigger_backup))
        .route("/api/devices/:id/backups", get(handlers::backups::list_backups))
        .route("/api/backups/:id", get(handlers::backups::get_backup))
        // Settings routes
        .route("/api/settings", get(handlers::settings::get_settings))
        .route("/api/settings", put(handlers::settings::update_settings))
        .route("/api/reload", post(handlers::settings::reload_config))
        .route("/api/network/addresses", get(handlers::settings::get_local_addresses))
        // Branding routes (get_branding and get_logo are public, upload/delete require auth)
        .route("/api/branding", get(handlers::settings::get_branding))
        .route("/api/branding/logo", get(handlers::settings::get_logo))
        .route("/api/branding/logo", post(handlers::settings::upload_logo))
        .route("/api/branding/logo", delete(handlers::settings::delete_logo))
        // Vendor routes
        .route("/api/vendors", get(handlers::vendors::list_vendors))
        .route("/api/vendors", post(handlers::vendors::create_vendor))
        .route("/api/vendors/defaults", get(handlers::vendors::get_default_vendors))
        .route("/api/vendors/:id", get(handlers::vendors::get_vendor))
        .route("/api/vendors/:id", put(handlers::vendors::update_vendor))
        .route("/api/vendors/:id", delete(handlers::vendors::delete_vendor))
        .route("/api/vendors/:id/actions", get(handlers::vendors::list_vendor_actions_by_vendor))
        // Device model routes
        .route("/api/device-models", get(handlers::device_models::list_device_models))
        .route("/api/device-models", post(handlers::device_models::create_device_model))
        .route("/api/device-models/:id", get(handlers::device_models::get_device_model))
        .route("/api/device-models/:id", put(handlers::device_models::update_device_model))
        .route("/api/device-models/:id", delete(handlers::device_models::delete_device_model))
        // Vendor action routes
        .route("/api/vendor-actions", get(handlers::vendors::list_vendor_actions))
        .route("/api/vendor-actions", post(handlers::vendors::create_vendor_action))
        .route("/api/vendor-actions/:id", put(handlers::vendors::update_vendor_action))
        .route("/api/vendor-actions/:id", delete(handlers::vendors::delete_vendor_action))
        .route("/api/vendor-actions/:id/run", post(handlers::vendors::run_vendor_action))
        // Topology routes
        .route("/api/topologies", get(handlers::topologies::list_topologies))
        .route("/api/topologies", post(handlers::topologies::create_topology))
        .route("/api/topologies/:id", get(handlers::topologies::get_topology))
        .route("/api/topologies/:id", put(handlers::topologies::update_topology))
        .route("/api/topologies/:id", delete(handlers::topologies::delete_topology))
        // Template routes
        .route("/api/templates", get(handlers::templates::list_templates))
        .route("/api/templates", post(handlers::templates::create_template))
        .route("/api/templates/_/variables", get(handlers::templates::get_template_variables))
        .route("/api/templates/:id", get(handlers::templates::get_template))
        .route("/api/templates/:id", put(handlers::templates::update_template))
        .route("/api/templates/:id", delete(handlers::templates::delete_template))
        .route("/api/templates/:id/preview", post(handlers::templates::preview_template))
        // Group routes
        .route("/api/groups", get(handlers::groups::list_groups))
        .route("/api/groups", post(handlers::groups::create_group))
        .route("/api/groups/:id", get(handlers::groups::get_group))
        .route("/api/groups/:id", put(handlers::groups::update_group))
        .route("/api/groups/:id", delete(handlers::groups::delete_group))
        .route("/api/groups/:id/variables", get(handlers::groups::list_group_variables))
        .route("/api/groups/:id/variables/:key", put(handlers::groups::set_group_variable))
        .route("/api/groups/:id/variables/:key", delete(handlers::groups::delete_group_variable))
        .route("/api/groups/:id/members", get(handlers::groups::list_group_members))
        .route("/api/groups/:id/members", put(handlers::groups::set_group_members))
        .route("/api/groups/:id/members/:device_id", put(handlers::groups::add_group_member))
        .route("/api/groups/:id/members/:device_id", delete(handlers::groups::remove_group_member))
        // Device group routes
        .route("/api/devices/:id/groups", get(handlers::groups::list_device_groups))
        .route("/api/devices/:id/groups", put(handlers::groups::set_device_groups))
        .route("/api/devices/:id/resolved-variables", get(handlers::groups::get_resolved_variables))
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
        .route("/api/docker/containers/:id/start", post(handlers::docker::start_container))
        .route("/api/docker/containers/:id/restart", post(handlers::docker::restart_container))
        // Unified topology builder (CLOS or Hierarchical)
        .route("/api/topology-builder", post(handlers::docker::build_topology))
        .route("/api/topology-builder/preview", post(handlers::docker::preview_topology))
        .route("/api/topology-builder/clos", delete(handlers::docker::teardown_virtual_clos))
        .route("/api/topology-builder/hierarchical", delete(handlers::docker::teardown_three_tier))
        // IPAM Region routes
        .route("/api/ipam/regions", get(handlers::ipam::list_regions))
        .route("/api/ipam/regions", post(handlers::ipam::create_region))
        .route("/api/ipam/regions/:id", get(handlers::ipam::get_region))
        .route("/api/ipam/regions/:id", put(handlers::ipam::update_region))
        .route("/api/ipam/regions/:id", delete(handlers::ipam::delete_region))
        // IPAM Campus routes
        .route("/api/ipam/campuses", get(handlers::ipam::list_campuses))
        .route("/api/ipam/campuses", post(handlers::ipam::create_campus))
        .route("/api/ipam/campuses/:id", get(handlers::ipam::get_campus))
        .route("/api/ipam/campuses/:id", put(handlers::ipam::update_campus))
        .route("/api/ipam/campuses/:id", delete(handlers::ipam::delete_campus))
        // IPAM Datacenter routes
        .route("/api/ipam/datacenters", get(handlers::ipam::list_datacenters))
        .route("/api/ipam/datacenters", post(handlers::ipam::create_datacenter))
        .route("/api/ipam/datacenters/:id", get(handlers::ipam::get_datacenter))
        .route("/api/ipam/datacenters/:id", put(handlers::ipam::update_datacenter))
        .route("/api/ipam/datacenters/:id", delete(handlers::ipam::delete_datacenter))
        // IPAM Hall routes
        .route("/api/ipam/halls", get(handlers::ipam::list_halls))
        .route("/api/ipam/halls", post(handlers::ipam::create_hall))
        .route("/api/ipam/halls/:id", get(handlers::ipam::get_hall))
        .route("/api/ipam/halls/:id", put(handlers::ipam::update_hall))
        .route("/api/ipam/halls/:id", delete(handlers::ipam::delete_hall))
        // IPAM Row routes
        .route("/api/ipam/rows", get(handlers::ipam::list_rows))
        .route("/api/ipam/rows", post(handlers::ipam::create_row))
        .route("/api/ipam/rows/:id", get(handlers::ipam::get_row))
        .route("/api/ipam/rows/:id", put(handlers::ipam::update_row))
        .route("/api/ipam/rows/:id", delete(handlers::ipam::delete_row))
        // IPAM Rack routes
        .route("/api/ipam/racks", get(handlers::ipam::list_racks))
        .route("/api/ipam/racks", post(handlers::ipam::create_rack))
        .route("/api/ipam/racks/:id", get(handlers::ipam::get_rack))
        .route("/api/ipam/racks/:id", put(handlers::ipam::update_rack))
        .route("/api/ipam/racks/:id", delete(handlers::ipam::delete_rack))
        // IPAM Role routes
        .route("/api/ipam/roles", get(handlers::ipam::list_roles))
        .route("/api/ipam/roles", post(handlers::ipam::create_role))
        .route("/api/ipam/roles/:id", delete(handlers::ipam::delete_role))
        // IPAM Prefix routes
        .route("/api/ipam/prefixes", get(handlers::ipam::list_prefixes))
        .route("/api/ipam/prefixes/supernets", get(handlers::ipam::list_supernets))
        .route("/api/ipam/prefixes", post(handlers::ipam::create_prefix))
        .route("/api/ipam/prefixes/:id", get(handlers::ipam::get_prefix))
        .route("/api/ipam/prefixes/:id", put(handlers::ipam::update_prefix))
        .route("/api/ipam/prefixes/:id", delete(handlers::ipam::delete_prefix))
        .route("/api/ipam/prefixes/:id/available-prefixes", post(handlers::ipam::next_available_prefix))
        .route("/api/ipam/prefixes/:id/available-ips", post(handlers::ipam::next_available_ip))
        // IPAM IP Address routes
        .route("/api/ipam/ip-addresses", get(handlers::ipam::list_ip_addresses))
        .route("/api/ipam/ip-addresses", post(handlers::ipam::create_ip_address))
        .route("/api/ipam/ip-addresses/:id", get(handlers::ipam::get_ip_address))
        .route("/api/ipam/ip-addresses/:id", put(handlers::ipam::update_ip_address))
        .route("/api/ipam/ip-addresses/:id", delete(handlers::ipam::delete_ip_address))
        // IPAM VRF routes
        .route("/api/ipam/vrfs", get(handlers::ipam::list_vrfs))
        .route("/api/ipam/vrfs", post(handlers::ipam::create_vrf))
        .route("/api/ipam/vrfs/:id", delete(handlers::ipam::delete_vrf))
        // IPAM Tag routes
        .route("/api/ipam/tags/keys", get(handlers::ipam::list_tag_keys))
        .route("/api/ipam/tags/:resource_type/:resource_id", get(handlers::ipam::list_tags))
        .route("/api/ipam/tags/:resource_type/:resource_id", post(handlers::ipam::set_tag))
        .route("/api/ipam/tags/:resource_type/:resource_id/:key", delete(handlers::ipam::delete_tag))
        // Credential routes
        .route("/api/credentials", get(handlers::credentials::list_credentials))
        .route("/api/credentials", post(handlers::credentials::create_credential))
        .route("/api/credentials/:id", get(handlers::credentials::get_credential))
        .route("/api/credentials/:id", put(handlers::credentials::update_credential))
        .route("/api/credentials/:id", delete(handlers::credentials::delete_credential))
        // Device Role routes
        .route("/api/device-roles", get(handlers::device_roles::list_device_roles))
        .route("/api/device-roles", post(handlers::device_roles::create_device_role))
        .route("/api/device-roles/:id", get(handlers::device_roles::get_device_role))
        .route("/api/device-roles/:id", put(handlers::device_roles::update_device_role))
        .route("/api/device-roles/:id", delete(handlers::device_roles::delete_device_role))
        // Output Parser routes
        .route("/api/output-parsers", get(handlers::output_parsers::list_output_parsers))
        .route("/api/output-parsers", post(handlers::output_parsers::create_output_parser))
        .route("/api/output-parsers/:id", get(handlers::output_parsers::get_output_parser))
        .route("/api/output-parsers/:id", put(handlers::output_parsers::update_output_parser))
        .route("/api/output-parsers/:id", delete(handlers::output_parsers::delete_output_parser))
        // User management routes
        .route("/api/users", get(handlers::users::list_users))
        .route("/api/users", post(handlers::users::create_user))
        .route("/api/users/:id", get(handlers::users::get_user))
        .route("/api/users/:id", put(handlers::users::update_user))
        .route("/api/users/:id", delete(handlers::users::delete_user))
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
