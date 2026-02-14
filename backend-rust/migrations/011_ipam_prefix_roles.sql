-- Support multiple roles per prefix via junction table (mirrors ipam_ip_address_roles)
CREATE TABLE IF NOT EXISTS ipam_prefix_roles (
    prefix_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (prefix_id, role_id),
    FOREIGN KEY (prefix_id) REFERENCES ipam_prefixes(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE CASCADE
);

-- Add prefix-oriented roles
INSERT OR IGNORE INTO ipam_roles (id, name, description, created_at) VALUES
    ('pool', 'Pool', 'Address allocation pool', CURRENT_TIMESTAMP),
    ('transit', 'Transit', 'Transit / point-to-point link subnet', CURRENT_TIMESTAMP),
    ('infrastructure', 'Infrastructure', 'Network infrastructure subnet', CURRENT_TIMESTAMP),
    ('customer', 'Customer', 'Customer-assigned prefix', CURRENT_TIMESTAMP);
