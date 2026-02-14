-- IPAM: IP Address Management for ZTP
-- Organizational hierarchy: Regions -> Locations -> Datacenters
-- IP hierarchy: Prefixes (self-nesting supernets/prefixes) -> IP Addresses
-- Polymorphic tagging on any IPAM resource
-- IP roles for address classification

-- ============================================================
-- Organizational Hierarchy
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ipam_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    region_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (region_id) REFERENCES ipam_regions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ipam_locations_region ON ipam_locations(region_id);

CREATE TABLE IF NOT EXISTS ipam_datacenters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    location_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES ipam_locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ipam_datacenters_location ON ipam_datacenters(location_id);

-- ============================================================
-- IP Roles (seed data)
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ipam_roles (id, name, description) VALUES
    ('gateway', 'Gateway', 'Default gateway / router interface'),
    ('loopback', 'Loopback', 'Router/switch loopback address'),
    ('dns_server', 'DNS Server', 'DNS resolver'),
    ('ntp_server', 'NTP Server', 'Network time server'),
    ('syslog_server', 'Syslog Server', 'Syslog collector'),
    ('snmp_server', 'SNMP Server', 'SNMP management station'),
    ('tacacs_server', 'TACACS+ Server', 'TACACS+ authentication server'),
    ('radius_server', 'RADIUS Server', 'RADIUS authentication server'),
    ('vip', 'Virtual IP', 'VRRP/HSRP/CARP virtual address'),
    ('management', 'Management', 'Out-of-band management address'),
    ('anycast', 'Anycast', 'Anycast service address');

-- ============================================================
-- Prefixes (unified: supernets, aggregates, subnets)
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_prefixes (
    id TEXT PRIMARY KEY,
    prefix TEXT NOT NULL,
    network_int INTEGER NOT NULL,
    broadcast_int INTEGER NOT NULL,
    prefix_length INTEGER NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    is_supernet INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT DEFAULT NULL,
    datacenter_id TEXT DEFAULT NULL,
    vlan_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES ipam_prefixes(id) ON DELETE SET NULL,
    FOREIGN KEY (datacenter_id) REFERENCES ipam_datacenters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_parent ON ipam_prefixes(parent_id);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_datacenter ON ipam_prefixes(datacenter_id);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_network ON ipam_prefixes(network_int, broadcast_int);
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_status ON ipam_prefixes(status);

-- ============================================================
-- IP Addresses (individual hosts)
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_ip_addresses (
    id TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    address_int INTEGER NOT NULL,
    prefix_id TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    role_id TEXT DEFAULT NULL,
    dns_name TEXT DEFAULT '',
    device_mac TEXT DEFAULT NULL,
    interface_name TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE SET NULL,
    FOREIGN KEY (device_mac) REFERENCES devices(mac) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ipam_ips_prefix ON ipam_ip_addresses(prefix_id);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_address ON ipam_ip_addresses(address_int);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_role ON ipam_ip_addresses(role_id);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_device ON ipam_ip_addresses(device_mac);
CREATE INDEX IF NOT EXISTS idx_ipam_ips_status ON ipam_ip_addresses(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipam_ips_unique_addr ON ipam_ip_addresses(address_int, prefix_id);

-- ============================================================
-- Tags (polymorphic key-value on any IPAM resource)
-- ============================================================

CREATE TABLE IF NOT EXISTS ipam_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_type, resource_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ipam_tags_resource ON ipam_tags(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ipam_tags_kv ON ipam_tags(key, value);
