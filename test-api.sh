#!/bin/bash
# Comprehensive API test script for ZTP Server
# Usage: ./test-api.sh [base_url]

BASE_URL="${1:-http://localhost:8080}"
PASS=0
FAIL=0

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function to test an endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_status="$4"
    local description="$5"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} [$method $endpoint] $description (HTTP $status_code)"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC} [$method $endpoint] $description"
        echo "  Expected: HTTP $expected_status, Got: HTTP $status_code"
        echo "  Response: $body"
        ((FAIL++))
    fi

    # Return the body for use in subsequent tests
    echo "$body" > /tmp/last_response.json
}

# Helper to test an endpoint accepting multiple valid status codes (pipe-separated)
test_endpoint_any() {
    local method="$1"
    local endpoint="$2"
    local data="$3"
    local expected_statuses="$4"
    local description="$5"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if echo "$expected_statuses" | grep -qw "$status_code"; then
        echo -e "${GREEN}✓ PASS${NC} [$method $endpoint] $description (HTTP $status_code)"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC} [$method $endpoint] $description"
        echo "  Expected: HTTP $expected_statuses, Got: HTTP $status_code"
        echo "  Response: $body"
        ((FAIL++))
    fi

    echo "$body" > /tmp/last_response.json
}

# Helper to extract value from JSON
get_json_value() {
    cat /tmp/last_response.json | python3 -c "import sys, json; print(json.load(sys.stdin)$1)" 2>/dev/null
}

echo "=============================================="
echo "ZTP Server API Test Suite"
echo "Base URL: $BASE_URL"
echo "=============================================="
echo ""

# ==================== BENCHMARK ENDPOINTS ====================
echo -e "${YELLOW}=== Benchmark Endpoints ===${NC}"

test_endpoint "GET" "/api/benchmark" "" "200" "Static benchmark"

test_endpoint "GET" "/api/json-bench" "" "200" "JSON serialization benchmark"

test_endpoint "GET" "/api/template-simple" "" "200" "Simple template benchmark"

test_endpoint "GET" "/api/template-large" "" "200" "Large template benchmark"

test_endpoint "GET" "/api/template-acl" "" "200" "ACL template benchmark (1000 terms)"

test_endpoint "GET" "/api/template-acl10k" "" "200" "ACL template benchmark (10000 terms)"

# Skip mandelbrot in regular tests (too slow for Python)
# test_endpoint "GET" "/api/mandelbrot" "" "200" "Mandelbrot benchmark"

echo ""

# ==================== SETTINGS ====================
echo -e "${YELLOW}=== Settings API ===${NC}"

test_endpoint "GET" "/api/settings" "" "200" "Get settings"

test_endpoint "PUT" "/api/settings" '{
    "default_ssh_user": "admin",
    "default_ssh_pass": "admin123",
    "backup_command": "show running-config",
    "backup_delay": 30,
    "dhcp_range_start": "172.30.0.100",
    "dhcp_range_end": "172.30.0.200",
    "dhcp_subnet": "255.255.255.0",
    "dhcp_gateway": "172.30.0.1",
    "tftp_server_ip": "172.30.0.2"
}' "200" "Update settings"

test_endpoint "POST" "/api/reload" "" "200" "Reload configuration"

test_endpoint "GET" "/api/network/addresses" "" "200" "Get network interfaces"

echo ""

# ==================== VENDORS ====================
echo -e "${YELLOW}=== Vendors API ===${NC}"

test_endpoint "GET" "/api/vendors" "" "200" "List vendors"

test_endpoint "GET" "/api/vendors/defaults" "" "200" "Get default vendors"

test_endpoint "GET" "/api/vendors/cisco" "" "200" "Get Cisco vendor"

test_endpoint "POST" "/api/vendors" '{
    "id": "test-vendor",
    "name": "Test Vendor",
    "backup_command": "show config",
    "ssh_port": 22,
    "mac_prefixes": ["AA:BB:CC"],
    "vendor_class": "Test Vendor Inc.",
    "default_template": ""
}' "201" "Create vendor"

test_endpoint "PUT" "/api/vendors/test-vendor" '{
    "id": "test-vendor",
    "name": "Test Vendor Updated",
    "backup_command": "show running-config",
    "ssh_port": 22,
    "mac_prefixes": ["AA:BB:CC", "DD:EE:FF"],
    "vendor_class": "Test Vendor Inc.",
    "default_template": ""
}' "200" "Update vendor"

test_endpoint "GET" "/api/vendors/test-vendor" "" "200" "Get updated vendor"

test_endpoint "DELETE" "/api/vendors/test-vendor" "" "204" "Delete vendor"

test_endpoint "GET" "/api/vendors/test-vendor" "" "404" "Verify vendor deleted"

echo ""

# ==================== TEMPLATES ====================
echo -e "${YELLOW}=== Templates API ===${NC}"

test_endpoint "GET" "/api/templates" "" "200" "List templates"

test_endpoint "GET" "/api/templates/_/variables" "" "200" "Get template variables"

test_endpoint "GET" "/api/templates/cisco-ios" "" "200" "Get Cisco IOS template"

test_endpoint "POST" "/api/templates" '{
    "id": "test-template",
    "name": "Test Template",
    "description": "A test template",
    "vendor_id": "cisco",
    "content": "hostname {{.Hostname}}\nip address {{.IP}} {{.Subnet}}"
}' "201" "Create template"

test_endpoint "POST" "/api/templates/test-template/preview" '{
    "content": "",
    "variables": {
        "Hostname": "test-switch",
        "IP": "192.168.1.100",
        "Subnet": "255.255.255.0",
        "Gateway": "192.168.1.1"
    }
}' "200" "Preview template"

test_endpoint "PUT" "/api/templates/test-template" '{
    "id": "test-template",
    "name": "Test Template Updated",
    "description": "An updated test template",
    "vendor_id": "cisco",
    "content": "! Updated\nhostname {{.Hostname}}\nip address {{.IP}} {{.Subnet}}"
}' "200" "Update template"

test_endpoint "DELETE" "/api/templates/test-template" "" "204" "Delete template"

echo ""

# ==================== DHCP OPTIONS ====================
echo -e "${YELLOW}=== DHCP Options API ===${NC}"

test_endpoint "GET" "/api/dhcp-options" "" "200" "List DHCP options"

test_endpoint "GET" "/api/dhcp-options/defaults" "" "200" "Get default DHCP options"

test_endpoint "GET" "/api/dhcp-options/tftp-server" "" "200" "Get TFTP server option"

test_endpoint "POST" "/api/dhcp-options" '{
    "id": "test-option",
    "option_number": 250,
    "name": "Test Option",
    "value": "test-value",
    "type": "string",
    "vendor_id": "",
    "description": "A test DHCP option",
    "enabled": true
}' "201" "Create DHCP option"

test_endpoint "PUT" "/api/dhcp-options/test-option" '{
    "id": "test-option",
    "option_number": 250,
    "name": "Test Option Updated",
    "value": "updated-value",
    "type": "string",
    "vendor_id": "",
    "description": "An updated test option",
    "enabled": false
}' "200" "Update DHCP option"

test_endpoint "DELETE" "/api/dhcp-options/test-option" "" "204" "Delete DHCP option"

echo ""

# ==================== DEVICES ====================
echo -e "${YELLOW}=== Devices API ===${NC}"

test_endpoint "GET" "/api/devices" "" "200" "List devices (empty)"

test_endpoint "POST" "/api/devices" '{
    "mac": "00:11:22:33:44:55",
    "ip": "172.30.0.101",
    "hostname": "test-switch-1",
    "vendor": "cisco",
    "model": "Catalyst 2960",
    "serial_number": "ABC123",
    "config_template": "cisco-ios"
}' "201" "Create device 1"

test_endpoint "POST" "/api/devices" '{
    "mac": "AA:BB:CC:DD:EE:FF",
    "ip": "172.30.0.102",
    "hostname": "test-switch-2",
    "vendor": "arista",
    "config_template": "arista-eos"
}' "201" "Create device 2"

test_endpoint "POST" "/api/devices" '{
    "mac": "11:22:33:44:55:66",
    "ip": "172.30.0.103",
    "hostname": "test-router-1"
}' "201" "Create device 3 (minimal)"

test_endpoint "GET" "/api/devices" "" "200" "List devices (should have 3)"

test_endpoint "GET" "/api/devices/00:11:22:33:44:55" "" "200" "Get device by MAC"

test_endpoint "GET" "/api/devices/00-11-22-33-44-55" "" "200" "Get device by MAC (dash format)"

test_endpoint "PUT" "/api/devices/00:11:22:33:44:55" '{
    "ip": "172.30.0.111",
    "hostname": "test-switch-1-updated",
    "vendor": "cisco",
    "model": "Catalyst 3850",
    "serial_number": "XYZ789",
    "config_template": "cisco-ios",
    "ssh_user": "admin",
    "ssh_pass": "secret123"
}' "200" "Update device"

test_endpoint "GET" "/api/devices/00:11:22:33:44:55/config" "" "200" "Get device config"

# Test duplicate MAC
test_endpoint "POST" "/api/devices" '{
    "mac": "00:11:22:33:44:55",
    "ip": "172.30.0.199",
    "hostname": "duplicate"
}' "409" "Reject duplicate MAC"

# Test invalid request
test_endpoint "POST" "/api/devices" '{
    "mac": "",
    "ip": "",
    "hostname": ""
}' "400" "Reject empty fields"

echo ""

# ==================== BACKUPS ====================
echo -e "${YELLOW}=== Backups API ===${NC}"

test_endpoint "GET" "/api/devices/00:11:22:33:44:55/backups" "" "200" "List device backups"

test_endpoint "POST" "/api/devices/00:11:22:33:44:55/backup" "" "202" "Trigger backup"

# Note: Getting a backup by ID would require knowing a valid backup ID
# test_endpoint "GET" "/api/backups/1" "" "200" "Get backup by ID"

echo ""

# ==================== DISCOVERY ====================
echo -e "${YELLOW}=== Discovery API ===${NC}"

test_endpoint "GET" "/api/discovery" "" "200" "List undiscovered devices"

test_endpoint "GET" "/api/discovery/leases" "" "200" "Get DHCP leases"

test_endpoint "GET" "/api/discovery/logs" "" "200" "Get discovery logs"

test_endpoint "GET" "/api/discovery/logs?limit=10" "" "200" "Get discovery logs (with limit)"

test_endpoint "POST" "/api/discovery/clear" "" "200" "Clear discovery tracking"

test_endpoint "DELETE" "/api/discovery/logs" "" "200" "Clear discovery logs"

echo ""

# ==================== NETBOX ====================
echo -e "${YELLOW}=== NetBox API ===${NC}"

test_endpoint "GET" "/api/netbox/status" "" "200" "Get NetBox status"

test_endpoint "GET" "/api/netbox/config" "" "200" "Get NetBox config"

test_endpoint "PUT" "/api/netbox/config" '{
    "url": "https://netbox.example.com",
    "token": "test-token-12345",
    "site_id": 1,
    "role_id": 1,
    "sync_enabled": false
}' "200" "Update NetBox config"

# NetBox API queries return 500 when configured URL is unreachable (expected)
# or 400 when not configured - both are acceptable without a real NetBox
test_endpoint "GET" "/api/netbox/manufacturers" "" "500" "Get manufacturers (fails without NetBox)"

test_endpoint "GET" "/api/netbox/sites" "" "500" "Get sites (fails without NetBox)"

test_endpoint "GET" "/api/netbox/device-roles" "" "500" "Get device roles (fails without NetBox)"

# Sync operations - Go returns 200 (errors in body), Rust/Python return 500
test_endpoint_any "POST" "/api/netbox/sync/push" "" "200 500" "Sync push (no NetBox)"

test_endpoint "POST" "/api/netbox/sync/pull" "" "500" "Sync pull (fails without NetBox)"

# Vendor sync - Go/Rust have these, Python may not (404)
test_endpoint_any "POST" "/api/netbox/sync/vendors/push" "" "200 404 500" "Vendor sync push (no NetBox)"

test_endpoint_any "POST" "/api/netbox/sync/vendors/pull" "" "200 404 500" "Vendor sync pull (no NetBox)"

echo ""

# ==================== CONNECTIVITY ====================
echo -e "${YELLOW}=== Connectivity Tests ===${NC}"

# This will likely fail (device not reachable) but tests the endpoint
test_endpoint "POST" "/api/devices/00:11:22:33:44:55/connect" "" "200" "Test device connectivity"

echo ""

# ==================== CONFIG SERVER ====================
echo -e "${YELLOW}=== Config Server ===${NC}"

# Config file serving - may return 404 if config generation failed or wasn't triggered
# This tests the endpoint works, not necessarily that a config exists
test_endpoint "GET" "/configs/nonexistent.cfg" "" "404" "Config file not found"

# Security test - path traversal should be rejected (URL-encoded)
test_endpoint "GET" "/configs/..%2Fetc%2Fpasswd" "" "400" "Reject path traversal"

echo ""

# ==================== CLEANUP ====================
echo -e "${YELLOW}=== Cleanup ===${NC}"

test_endpoint "DELETE" "/api/devices/00:11:22:33:44:55" "" "204" "Delete device 1"

test_endpoint "DELETE" "/api/devices/aa:bb:cc:dd:ee:ff" "" "204" "Delete device 2"

test_endpoint "DELETE" "/api/devices/11:22:33:44:55:66" "" "204" "Delete device 3"

test_endpoint "GET" "/api/devices" "" "200" "Verify all devices deleted"

test_endpoint "DELETE" "/api/devices/nonexistent" "" "404" "Delete nonexistent device"

echo ""

# ==================== SUMMARY ====================
echo "=============================================="
echo -e "Test Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "=============================================="

# Exit with error if any tests failed
if [ $FAIL -gt 0 ]; then
    exit 1
fi
exit 0
