-- Support multiple roles per IP address via junction table

CREATE TABLE IF NOT EXISTS ipam_ip_address_roles (
    ip_address_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    PRIMARY KEY (ip_address_id, role_id),
    FOREIGN KEY (ip_address_id) REFERENCES ipam_ip_addresses(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES ipam_roles(id) ON DELETE CASCADE
);

-- Migrate existing role_id data to the junction table
INSERT OR IGNORE INTO ipam_ip_address_roles (ip_address_id, role_id)
SELECT id, role_id FROM ipam_ip_addresses WHERE role_id IS NOT NULL AND role_id != '';
