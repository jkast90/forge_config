-- IPAM VRF (Virtual Routing and Forwarding) support
-- Allows the same CIDR prefix to exist in different routing domains

CREATE TABLE IF NOT EXISTS ipam_vrfs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rd TEXT DEFAULT '',
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add vrf_id to prefixes (same prefix allowed in different VRFs)
ALTER TABLE ipam_prefixes ADD COLUMN vrf_id TEXT DEFAULT NULL REFERENCES ipam_vrfs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ipam_prefixes_vrf ON ipam_prefixes(vrf_id);

-- Add vrf_id to ip_addresses
ALTER TABLE ipam_ip_addresses ADD COLUMN vrf_id TEXT DEFAULT NULL REFERENCES ipam_vrfs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ipam_ips_vrf ON ipam_ip_addresses(vrf_id);
