-- ForgeConfig consolidated schema
-- All resource IDs use INTEGER PRIMARY KEY AUTOINCREMENT (except jobs which use TEXT UUIDs)

-- ── Settings ──────────────────────────────────────────────────
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
);

-- ── Users ─────────────────────────────────────────────────────
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Credentials ───────────────────────────────────────────────
CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    cred_type TEXT NOT NULL DEFAULT 'ssh',
    username TEXT DEFAULT '',
    password TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Vendors ───────────────────────────────────────────────────
CREATE TABLE vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    backup_command TEXT DEFAULT 'show running-config',
    deploy_command TEXT DEFAULT '',
    diff_command TEXT DEFAULT '',
    ssh_port INTEGER DEFAULT 22,
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    mac_prefixes TEXT DEFAULT '[]',
    vendor_class TEXT DEFAULT '',
    default_template TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Templates ─────────────────────────────────────────────────
CREATE TABLE templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    vendor_id INTEGER DEFAULT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

CREATE INDEX idx_templates_vendor ON templates(vendor_id);

-- ── DHCP Options ──────────────────────────────────────────────
CREATE TABLE dhcp_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    option_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    value TEXT DEFAULT '',
    type TEXT DEFAULT 'string',
    vendor_id INTEGER DEFAULT NULL,
    description TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

CREATE INDEX idx_dhcp_options_vendor ON dhcp_options(vendor_id);

-- ── Vendor Actions ────────────────────────────────────────────
CREATE TABLE vendor_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    action_type TEXT NOT NULL DEFAULT 'ssh',
    webhook_url TEXT NOT NULL DEFAULT '',
    webhook_method TEXT NOT NULL DEFAULT 'POST',
    webhook_headers TEXT NOT NULL DEFAULT '{}',
    webhook_body TEXT NOT NULL DEFAULT '',
    output_parser_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX idx_vendor_actions_vendor ON vendor_actions(vendor_id);

-- ── Device Models ─────────────────────────────────────────────
CREATE TABLE device_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    model TEXT NOT NULL,
    display_name TEXT NOT NULL,
    rack_units INTEGER DEFAULT 1,
    layout TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_device_models_vendor_model ON device_models(vendor_id, model);

-- ── Output Parsers ────────────────────────────────────────────
CREATE TABLE output_parsers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    pattern TEXT NOT NULL DEFAULT '',
    extract_names TEXT NOT NULL DEFAULT '',
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Topologies ────────────────────────────────────────────────
CREATE TABLE topologies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id INTEGER DEFAULT NULL,
    campus_id INTEGER DEFAULT NULL,
    datacenter_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Devices ───────────────────────────────────────────────────
CREATE TABLE devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mac TEXT DEFAULT NULL,
    ip TEXT DEFAULT '',
    hostname TEXT NOT NULL,
    vendor TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    config_template TEXT DEFAULT '',
    ssh_user TEXT DEFAULT '',
    ssh_pass TEXT DEFAULT '',
    topology_id INTEGER DEFAULT NULL,
    topology_role TEXT DEFAULT '',
    status TEXT DEFAULT 'offline',
    last_seen DATETIME,
    last_backup DATETIME,
    last_error TEXT DEFAULT '',
    device_type TEXT NOT NULL DEFAULT 'internal',
    hall_id INTEGER DEFAULT NULL,
    row_id INTEGER DEFAULT NULL,
    rack_id INTEGER DEFAULT NULL,
    rack_position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_mac ON devices(mac);
CREATE INDEX idx_devices_topology ON devices(topology_id);
CREATE INDEX idx_devices_type ON devices(device_type);

-- ── Backups ───────────────────────────────────────────────────
CREATE TABLE backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_backups_device ON backups(device_id);

-- ── Device Variables ──────────────────────────────────────────
CREATE TABLE device_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    UNIQUE(device_id, key)
);

CREATE INDEX idx_device_variables_device ON device_variables(device_id);
CREATE INDEX idx_device_variables_key ON device_variables(key);

-- ── Jobs ──────────────────────────────────────────────────────
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    device_id INTEGER NOT NULL DEFAULT 0,
    command TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    output TEXT,
    error TEXT,
    credential_id TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);

CREATE INDEX idx_jobs_device ON jobs(device_id);
CREATE INDEX idx_jobs_status ON jobs(status);

-- ── Port Assignments ──────────────────────────────────────────
CREATE TABLE device_port_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    port_name TEXT NOT NULL,
    remote_device_id INTEGER,
    remote_port_name TEXT DEFAULT '',
    description TEXT DEFAULT '',
    patch_panel_a_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    patch_panel_a_port TEXT DEFAULT '',
    patch_panel_b_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
    patch_panel_b_port TEXT DEFAULT '',
    vrf_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (remote_device_id) REFERENCES devices(id) ON DELETE SET NULL,
    UNIQUE(device_id, port_name)
);

CREATE INDEX idx_port_assignments_device ON device_port_assignments(device_id);
CREATE INDEX idx_port_assignments_remote ON device_port_assignments(remote_device_id);
CREATE INDEX idx_port_assignments_vrf ON device_port_assignments(vrf_id);

-- ── Groups ────────────────────────────────────────────────────
CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    parent_id INTEGER DEFAULT NULL,
    precedence INTEGER NOT NULL DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE SET NULL
);

CREATE TABLE group_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(group_id, key)
);

CREATE TABLE device_group_members (
    device_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (device_id, group_id),
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_groups_parent ON groups(parent_id);
CREATE INDEX idx_group_variables_group ON group_variables(group_id);
CREATE INDEX idx_group_variables_key ON group_variables(key);
CREATE INDEX idx_dgm_device ON device_group_members(device_id);
CREATE INDEX idx_dgm_group ON device_group_members(group_id);

-- ── Device Roles ──────────────────────────────────────────────
CREATE TABLE device_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    group_names TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE device_role_templates (
    role_id INTEGER NOT NULL REFERENCES device_roles(id) ON DELETE CASCADE,
    template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    PRIMARY KEY (role_id, template_id)
);

-- ── Job Templates ─────────────────────────────────────────────
CREATE TABLE job_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    job_type TEXT NOT NULL DEFAULT 'command',
    command TEXT DEFAULT '',
    action_id INTEGER DEFAULT 0,
    target_mode TEXT NOT NULL DEFAULT 'device',
    target_device_ids TEXT DEFAULT '',
    target_group_id INTEGER DEFAULT 0,
    schedule TEXT DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    credential_id INTEGER DEFAULT 0,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Discovery ─────────────────────────────────────────────────
CREATE TABLE discovered_devices (
    mac TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    hostname TEXT DEFAULT '',
    vendor TEXT DEFAULT '',
    model TEXT DEFAULT '',
    serial_number TEXT DEFAULT '',
    vendor_class TEXT DEFAULT '',
    user_class TEXT DEFAULT '',
    dhcp_client_id TEXT DEFAULT '',
    requested_options TEXT DEFAULT '',
    relay_address TEXT DEFAULT '',
    circuit_id TEXT DEFAULT '',
    remote_id TEXT DEFAULT '',
    subscriber_id TEXT DEFAULT '',
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE discovery_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    mac TEXT NOT NULL,
    ip TEXT NOT NULL,
    hostname TEXT DEFAULT '',
    vendor TEXT DEFAULT '',
    message TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discovery_logs_mac ON discovery_logs(mac);
CREATE INDEX idx_discovery_logs_created ON discovery_logs(created_at DESC);

-- ── NetBox ────────────────────────────────────────────────────
CREATE TABLE netbox_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    url TEXT DEFAULT '',
    token TEXT DEFAULT '',
    site_id INTEGER DEFAULT 0,
    role_id INTEGER DEFAULT 0,
    sync_enabled INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── IPAM Location Hierarchy ──────────────────────────────────
CREATE TABLE ipam_regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ipam_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES ipam_regions(id) ON DELETE CASCADE
);

CREATE TABLE ipam_datacenters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    location_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES ipam_locations(id) ON DELETE CASCADE
);

CREATE TABLE ipam_halls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    datacenter_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters(id) ON DELETE CASCADE
);

CREATE TABLE ipam_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    hall_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hall_id) REFERENCES ipam_halls(id) ON DELETE CASCADE
);

CREATE TABLE ipam_racks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    row_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (row_id) REFERENCES ipam_rows(id) ON DELETE CASCADE
);

CREATE INDEX idx_ipam_locations_region ON ipam_locations(region_id);
CREATE INDEX idx_ipam_datacenters_location ON ipam_datacenters(location_id);
CREATE INDEX idx_ipam_halls_dc ON ipam_halls(datacenter_id);
CREATE INDEX idx_ipam_rows_hall ON ipam_rows(hall_id);
CREATE INDEX idx_ipam_racks_row ON ipam_racks(row_id);

-- ── Tenants ────────────────────────────────────────────────────
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_tenants_name ON tenants(name);

-- ── IPAM Roles & VRFs ────────────────────────────────────────
CREATE TABLE ipam_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ipam_vrfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    rd TEXT DEFAULT '',
    description TEXT DEFAULT '',
    tenant_id INTEGER DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ipam_roles_name ON ipam_roles(name);
CREATE INDEX idx_ipam_vrfs_name ON ipam_vrfs(name);
CREATE INDEX idx_ipam_vrfs_tenant ON ipam_vrfs(tenant_id);

-- ── IPAM Prefixes ─────────────────────────────────────────────
CREATE TABLE ipam_prefixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prefix TEXT NOT NULL,
    network_int INTEGER NOT NULL,
    broadcast_int INTEGER NOT NULL,
    prefix_length INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    is_supernet INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER DEFAULT NULL,
    datacenter_id INTEGER DEFAULT NULL,
    vlan_id INTEGER DEFAULT NULL,
    vrf_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES ipam_prefixes(id) ON DELETE SET NULL,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters(id) ON DELETE SET NULL,
    FOREIGN KEY (vrf_id) REFERENCES ipam_vrfs(id) ON DELETE SET NULL
);

CREATE TABLE ipam_prefix_roles (
    prefix_id INTEGER NOT NULL REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES ipam_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (prefix_id, role_id)
);

CREATE INDEX idx_ipam_prefixes_parent ON ipam_prefixes(parent_id);
CREATE INDEX idx_ipam_prefixes_datacenter ON ipam_prefixes(datacenter_id);
CREATE INDEX idx_ipam_prefixes_network ON ipam_prefixes(network_int, broadcast_int);
CREATE INDEX idx_ipam_prefixes_status ON ipam_prefixes(status);

-- ── IPAM IP Addresses ─────────────────────────────────────────
CREATE TABLE ipam_ip_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    address_int INTEGER NOT NULL,
    prefix_id INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    dns_name TEXT DEFAULT '',
    device_id INTEGER DEFAULT NULL,
    interface_name TEXT DEFAULT '',
    vrf_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (vrf_id) REFERENCES ipam_vrfs(id) ON DELETE SET NULL
);

CREATE TABLE ipam_ip_address_roles (
    ip_address_id INTEGER NOT NULL REFERENCES ipam_ip_addresses(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES ipam_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (ip_address_id, role_id)
);

CREATE INDEX idx_ipam_ip_addresses_prefix ON ipam_ip_addresses(prefix_id);
CREATE INDEX idx_ipam_ip_addresses_device ON ipam_ip_addresses(device_id);
CREATE INDEX idx_ipam_ip_addresses_vrf ON ipam_ip_addresses(vrf_id);
CREATE INDEX idx_ipam_ip_addresses_address_int ON ipam_ip_addresses(address_int);

-- ── IPAM Tags ─────────────────────────────────────────────────
CREATE TABLE ipam_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_type, resource_id, key)
);

CREATE INDEX idx_ipam_tags_resource ON ipam_tags(resource_type, resource_id);
CREATE INDEX idx_ipam_tags_kv ON ipam_tags(key, value);

-- GPU Clusters
CREATE TABLE gpu_clusters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    gpu_model TEXT NOT NULL DEFAULT 'MI300X',
    node_count INTEGER NOT NULL DEFAULT 1,
    gpus_per_node INTEGER NOT NULL DEFAULT 8,
    interconnect_type TEXT NOT NULL DEFAULT 'InfiniBand',
    status TEXT NOT NULL DEFAULT 'provisioning',
    topology_id INTEGER DEFAULT NULL,
    vrf_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topology_id) REFERENCES topologies(id) ON DELETE SET NULL
);
CREATE INDEX idx_gpu_clusters_topology ON gpu_clusters(topology_id);
CREATE INDEX idx_gpu_clusters_status ON gpu_clusters(status);
CREATE INDEX idx_gpu_clusters_vrf ON gpu_clusters(vrf_id);

-- ── Seed Data ────────────────────────────────────────────────
INSERT INTO tenants (name, description, status) VALUES ('Default', 'Default tenant', 'active');
INSERT INTO ipam_vrfs (name, rd, description, tenant_id) VALUES ('default', '65000:1', 'Default VRF', 1);
