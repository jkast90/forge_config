#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# test-openapi.sh — Exercise every CRUD endpoint against the API
#
# Usage:
#   ./scripts/test-openapi.sh                      # localhost:8080
#   ./scripts/test-openapi.sh http://myserver:8080  # custom base URL
# ──────────────────────────────────────────────────────────────────
set -euo pipefail

BASE="${1:-http://localhost:8080}"
PASS=0
FAIL=0
ERRORS=""

# ── Helpers ───────────────────────────────────────────────────────

auth() {
  TOKEN=$(curl -sf "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin"}' \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
  AUTH="Authorization: Bearer $TOKEN"
}

# call METHOD PATH [BODY]
# Prints response, sets $HTTP_CODE and $BODY
call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -w '\n%{http_code}' -X "$method" "$BASE$path" -H "$AUTH")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi
  local raw
  raw=$(curl "${args[@]}")
  BODY=$(echo "$raw" | sed '$d')
  HTTP_CODE=$(echo "$raw" | tail -1)
}

# expect CODE LABEL
expect() {
  local expected="$1" label="$2"
  if [ "$HTTP_CODE" = "$expected" ]; then
    printf "  ✓ %-60s %s\n" "$label" "$HTTP_CODE"
    PASS=$((PASS + 1))
  else
    printf "  ✗ %-60s %s (expected %s)\n" "$label" "$HTTP_CODE" "$expected"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  ✗ $label → $HTTP_CODE (expected $expected): $BODY"
  fi
}

section() { printf "\n── %s ──\n" "$1"; }

# ── Auth ──────────────────────────────────────────────────────────

section "Auth"
auth
echo "  ✓ POST /api/auth/login                                          200"
PASS=$((PASS + 1))

# ── Devices ───────────────────────────────────────────────────────

section "Devices"

call POST /api/devices '{"mac":"aa:bb:cc:dd:ee:f0","ip":"172.30.0.200","hostname":"test-openapi","config_template":"generic-switch","vendor":"cisco","model":"C9300","serial_number":"SN-TEST-001"}'
expect 201 "POST /api/devices (create)"

call GET /api/devices
expect 200 "GET /api/devices (list)"

call GET /api/devices/aa:bb:cc:dd:ee:f0
expect 200 "GET /api/devices/:mac (get)"

call PUT /api/devices/aa:bb:cc:dd:ee:f0 '{"ip":"172.30.0.201","hostname":"test-openapi-updated","config_template":"generic-switch","vendor":"cisco","model":"C9300-24T","serial_number":"SN-TEST-001"}'
expect 200 "PUT /api/devices/:mac (update)"

call GET /api/devices/aa:bb:cc:dd:ee:f0/config
expect 200 "GET /api/devices/:mac/config (rendered config)"

# ── Device Variables ──────────────────────────────────────────────

section "Device Variables"

call PUT /api/devices/aa:bb:cc:dd:ee:f0/variables/test_var '{"value":"hello123"}'
expect 200 "PUT /api/devices/:mac/variables/:key (set single)"

call PUT /api/devices/aa:bb:cc:dd:ee:f0/variables '{"variables":{"ntp_server":"10.0.0.1","snmp_community":"public"}}'
expect 200 "PUT /api/devices/:mac/variables (bulk set)"

call GET /api/devices/aa:bb:cc:dd:ee:f0/variables
expect 200 "GET /api/devices/:mac/variables (list)"

call DELETE /api/devices/aa:bb:cc:dd:ee:f0/variables/ntp_server
expect 200 "DELETE /api/devices/:mac/variables/:key (delete)"

call GET /api/variables/keys
expect 200 "GET /api/variables/keys (list keys)"

call POST /api/variables/bulk '{"entries":[{"mac":"aa:bb:cc:dd:ee:f0","key":"bulk_var","value":"bv1"}]}'
expect 200 "POST /api/variables/bulk (bulk set)"

call GET /api/variables/by-key/snmp_community
expect 200 "GET /api/variables/by-key/:key (list by key)"

# ── Groups ────────────────────────────────────────────────────────

section "Groups"

call POST /api/groups '{"id":"test-group","name":"Test Group","description":"OpenAPI test","precedence":500}'
expect 201 "POST /api/groups (create)"

call GET /api/groups
expect 200 "GET /api/groups (list)"

call GET /api/groups/test-group
expect 200 "GET /api/groups/:id (get)"

call PUT /api/groups/test-group '{"id":"test-group","name":"Test Group Updated","description":"Updated","precedence":501}'
expect 200 "PUT /api/groups/:id (update)"

call PUT /api/groups/test-group/variables/region '{"value":"us-east"}'
expect 200 "PUT /api/groups/:id/variables/:key (set variable)"

call GET /api/groups/test-group/variables
expect 200 "GET /api/groups/:id/variables (list variables)"

call PUT /api/groups/test-group/members '{"macs":["aa:bb:cc:dd:ee:f0"]}'
expect 200 "PUT /api/groups/:id/members (set members)"

call GET /api/groups/test-group/members
expect 200 "GET /api/groups/:id/members (list members)"

call GET /api/devices/aa:bb:cc:dd:ee:f0/groups
expect 200 "GET /api/devices/:mac/groups (list device groups)"

call PUT /api/devices/aa:bb:cc:dd:ee:f0/groups '{"group_ids":["test-group"]}'
expect 200 "PUT /api/devices/:mac/groups (set device groups)"

call GET /api/devices/aa:bb:cc:dd:ee:f0/resolved-variables
expect 200 "GET /api/devices/:mac/resolved-variables"

# cleanup group
call DELETE /api/groups/test-group/members/aa:bb:cc:dd:ee:f0
expect 200 "DELETE /api/groups/:id/members/:mac (remove member)"

call DELETE /api/groups/test-group/variables/region
expect 200 "DELETE /api/groups/:id/variables/:key (delete variable)"

call DELETE /api/groups/test-group
expect 200 "DELETE /api/groups/:id (delete)"

# ── Templates ─────────────────────────────────────────────────────

section "Templates"

call POST /api/templates '{"id":"test-tpl","name":"Test Template","description":"OpenAPI test","content":"hostname {{Hostname}}"}'
expect 201 "POST /api/templates (create)"

call GET /api/templates
expect 200 "GET /api/templates (list)"

call GET /api/templates/test-tpl
expect 200 "GET /api/templates/:id (get)"

call PUT /api/templates/test-tpl '{"id":"test-tpl","name":"Test Template Updated","description":"Updated","content":"hostname {{Hostname}}"}'
expect 200 "PUT /api/templates/:id (update)"

call POST /api/templates/test-tpl/preview '{"device":{"mac":"aa:bb:cc:dd:ee:f0","ip":"10.0.0.1","hostname":"preview-test"},"subnet":"255.255.255.0","gateway":"10.0.0.254"}'
expect 200 "POST /api/templates/:id/preview"

call GET /api/templates/_/variables
expect 200 "GET /api/templates/_/variables (list built-in vars)"

call DELETE /api/templates/test-tpl
expect 204 "DELETE /api/templates/:id (delete)"

# ── Vendors ───────────────────────────────────────────────────────

section "Vendors"

call GET /api/vendors
expect 200 "GET /api/vendors (list)"

call GET /api/vendors/defaults
expect 200 "GET /api/vendors/defaults"

call POST /api/vendors '{"id":"test-vendor","name":"Test Vendor","backup_command":"show run","deploy_command":"","ssh_port":22,"ssh_user":"","ssh_pass":"","mac_prefixes":["AA:BB:CC"],"vendor_class":"","default_template":""}'
expect 201 "POST /api/vendors (create)"

call GET /api/vendors/test-vendor
expect 200 "GET /api/vendors/:id (get)"

call PUT /api/vendors/test-vendor '{"id":"test-vendor","name":"Test Vendor Updated","backup_command":"show run","deploy_command":"","ssh_port":22,"ssh_user":"","ssh_pass":"","mac_prefixes":["AA:BB:CC"],"vendor_class":"","default_template":""}'
expect 200 "PUT /api/vendors/:id (update)"

# Vendor actions
call POST /api/vendor-actions '{"id":"test-action","vendor_id":"test-vendor","label":"Show Version","command":"show version","sort_order":1}'
expect 201 "POST /api/vendor-actions (create)"

call GET /api/vendor-actions
expect 200 "GET /api/vendor-actions (list all)"

call GET /api/vendors/test-vendor/actions
expect 200 "GET /api/vendors/:id/actions (list for vendor)"

call PUT /api/vendor-actions/test-action '{"id":"test-action","vendor_id":"test-vendor","label":"Show Version Updated","command":"show version","sort_order":2}'
expect 200 "PUT /api/vendor-actions/:id (update)"

call DELETE /api/vendor-actions/test-action
expect 204 "DELETE /api/vendor-actions/:id (delete)"

call DELETE /api/vendors/test-vendor
expect 204 "DELETE /api/vendors/:id (delete)"

# ── Topologies ────────────────────────────────────────────────────

section "Topologies"

call POST /api/topologies '{"id":"test-topo","name":"Test Topology","description":"OpenAPI test"}'
expect 201 "POST /api/topologies (create)"

call GET /api/topologies
expect 200 "GET /api/topologies (list)"

call GET /api/topologies/test-topo
expect 200 "GET /api/topologies/:id (get)"

call PUT /api/topologies/test-topo '{"id":"test-topo","name":"Test Topology Updated","description":"Updated"}'
expect 200 "PUT /api/topologies/:id (update)"

call DELETE /api/topologies/test-topo
expect 204 "DELETE /api/topologies/:id (delete)"

# ── DHCP Options ──────────────────────────────────────────────────

section "DHCP Options"

call GET /api/dhcp-options
expect 200 "GET /api/dhcp-options (list)"

call GET /api/dhcp-options/defaults
expect 200 "GET /api/dhcp-options/defaults"

call POST /api/dhcp-options '{"id":"test-opt","option_number":150,"name":"Test TFTP","value":"172.30.0.2","type":"ip","description":"Test","enabled":true}'
expect 201 "POST /api/dhcp-options (create)"

call GET /api/dhcp-options/test-opt
expect 200 "GET /api/dhcp-options/:id (get)"

call PUT /api/dhcp-options/test-opt '{"id":"test-opt","option_number":150,"name":"Test TFTP Updated","value":"172.30.0.3","type":"ip","description":"Updated","enabled":false}'
expect 200 "PUT /api/dhcp-options/:id (update)"

call DELETE /api/dhcp-options/test-opt
expect 204 "DELETE /api/dhcp-options/:id (delete)"

# ── Backups ───────────────────────────────────────────────────────

section "Backups"

call GET /api/devices/aa:bb:cc:dd:ee:f0/backups
expect 200 "GET /api/devices/:mac/backups (list)"

# ── Discovery ─────────────────────────────────────────────────────

section "Discovery"

call GET /api/discovery
expect 200 "GET /api/discovery (list undiscovered)"

call GET /api/discovery/leases
expect 200 "GET /api/discovery/leases (list leases)"

call GET /api/discovery/logs
expect 200 "GET /api/discovery/logs (list logs)"

# ── Jobs ──────────────────────────────────────────────────────────

section "Jobs"

call GET /api/jobs
expect 200 "GET /api/jobs (list)"

# ── Docker ────────────────────────────────────────────────────────

section "Docker"

call GET /api/docker/containers
expect 200 "GET /api/docker/containers (list)"

# ── IPAM ──────────────────────────────────────────────────────────

section "IPAM"

# Regions
call POST /api/ipam/regions '{"id":"test-region","name":"Test Region","description":"OpenAPI test"}'
expect 201 "POST /api/ipam/regions (create)"

call GET /api/ipam/regions
expect 200 "GET /api/ipam/regions (list)"

call GET /api/ipam/regions/test-region
expect 200 "GET /api/ipam/regions/:id (get)"

call PUT /api/ipam/regions/test-region '{"id":"test-region","name":"Test Region Updated","description":"Updated"}'
expect 200 "PUT /api/ipam/regions/:id (update)"

# Locations
call POST /api/ipam/locations '{"id":"test-loc","name":"Test Location","region_id":"test-region"}'
expect 201 "POST /api/ipam/locations (create)"

call GET /api/ipam/locations
expect 200 "GET /api/ipam/locations (list)"

call GET /api/ipam/locations/test-loc
expect 200 "GET /api/ipam/locations/:id (get)"

call PUT /api/ipam/locations/test-loc '{"id":"test-loc","name":"Test Location Updated","region_id":"test-region"}'
expect 200 "PUT /api/ipam/locations/:id (update)"

# Datacenters
call POST /api/ipam/datacenters '{"id":"test-dc","name":"Test DC","location_id":"test-loc"}'
expect 201 "POST /api/ipam/datacenters (create)"

call GET /api/ipam/datacenters
expect 200 "GET /api/ipam/datacenters (list)"

call GET /api/ipam/datacenters/test-dc
expect 200 "GET /api/ipam/datacenters/:id (get)"

call PUT /api/ipam/datacenters/test-dc '{"id":"test-dc","name":"Test DC Updated","location_id":"test-loc"}'
expect 200 "PUT /api/ipam/datacenters/:id (update)"

# Roles
call POST /api/ipam/roles '{"id":"test-role","name":"Test Role"}'
expect 201 "POST /api/ipam/roles (create)"

call GET /api/ipam/roles
expect 200 "GET /api/ipam/roles (list)"

# VRFs
call POST /api/ipam/vrfs '{"id":"test-vrf","name":"TEST-VRF","rd":"65000:100","description":"Test VRF"}'
expect 201 "POST /api/ipam/vrfs (create)"

call GET /api/ipam/vrfs
expect 200 "GET /api/ipam/vrfs (list)"

# Prefixes
call POST /api/ipam/prefixes '{"id":"test-prefix","prefix":"192.168.99.0/24","status":"active","description":"Test prefix","is_supernet":false}'
expect 201 "POST /api/ipam/prefixes (create)"

call GET /api/ipam/prefixes
expect 200 "GET /api/ipam/prefixes (list)"

call GET /api/ipam/prefixes/supernets
expect 200 "GET /api/ipam/prefixes/supernets (list supernets)"

call GET /api/ipam/prefixes/test-prefix
expect 200 "GET /api/ipam/prefixes/:id (get)"

call PUT /api/ipam/prefixes/test-prefix '{"id":"test-prefix","prefix":"192.168.99.0/24","status":"reserved","description":"Updated prefix","is_supernet":false}'
expect 200 "PUT /api/ipam/prefixes/:id (update)"

# IP Addresses
call POST /api/ipam/ip-addresses '{"id":"test-ip","address":"192.168.99.1","prefix_id":"test-prefix","status":"active","description":"Test IP"}'
expect 201 "POST /api/ipam/ip-addresses (create)"

call GET /api/ipam/ip-addresses
expect 200 "GET /api/ipam/ip-addresses (list)"

call GET /api/ipam/ip-addresses/test-ip
expect 200 "GET /api/ipam/ip-addresses/:id (get)"

call PUT /api/ipam/ip-addresses/test-ip '{"id":"test-ip","address":"192.168.99.1","prefix_id":"test-prefix","status":"reserved","description":"Updated IP"}'
expect 200 "PUT /api/ipam/ip-addresses/:id (update)"

# Next available
call POST /api/ipam/prefixes/test-prefix/available-ips '{"description":"auto-assigned"}'
expect 201 "POST /api/ipam/prefixes/:id/available-ips (next IP)"

# Tags
call POST /api/ipam/tags/prefix/test-prefix '{"key":"env","value":"test"}'
expect 200 "POST /api/ipam/tags/:type/:id (set tag)"

call GET /api/ipam/tags/prefix/test-prefix
expect 200 "GET /api/ipam/tags/:type/:id (list tags)"

call GET /api/ipam/tags/keys
expect 200 "GET /api/ipam/tags/keys (list tag keys)"

call DELETE /api/ipam/tags/prefix/test-prefix/env
expect 200 "DELETE /api/ipam/tags/:type/:id/:key (delete tag)"

# IPAM Cleanup (reverse order of dependencies)
call DELETE /api/ipam/ip-addresses/test-ip
expect 204 "DELETE /api/ipam/ip-addresses/:id (delete)"

call DELETE /api/ipam/prefixes/test-prefix
expect 204 "DELETE /api/ipam/prefixes/:id (delete)"

call DELETE /api/ipam/vrfs/test-vrf
expect 204 "DELETE /api/ipam/vrfs/:id (delete)"

call DELETE /api/ipam/roles/test-role
expect 204 "DELETE /api/ipam/roles/:id (delete)"

call DELETE /api/ipam/datacenters/test-dc
expect 204 "DELETE /api/ipam/datacenters/:id (delete)"

call DELETE /api/ipam/locations/test-loc
expect 204 "DELETE /api/ipam/locations/:id (delete)"

call DELETE /api/ipam/regions/test-region
expect 204 "DELETE /api/ipam/regions/:id (delete)"

# ── NetBox ────────────────────────────────────────────────────────

section "NetBox"

call GET /api/netbox/status
expect 200 "GET /api/netbox/status"

call GET /api/netbox/config
expect 200 "GET /api/netbox/config"

# ── Settings ──────────────────────────────────────────────────────

section "Settings"

call GET /api/settings
expect 200 "GET /api/settings (get)"

call GET /api/network/addresses
expect 200 "GET /api/network/addresses (list interfaces)"

# ── Benchmarks ────────────────────────────────────────────────────

section "Benchmarks"

call GET /api/benchmark
expect 200 "GET /api/benchmark"

call GET /api/mandelbrot
expect 200 "GET /api/mandelbrot"

call GET /api/json-bench
expect 200 "GET /api/json-bench"

# ── Cleanup test device ──────────────────────────────────────────

section "Cleanup"

call DELETE /api/variables/keys/bulk_var
expect 200 "DELETE /api/variables/keys/:key (delete key)"

call DELETE /api/devices/aa:bb:cc:dd:ee:f0
expect 204 "DELETE /api/devices/:mac (delete test device)"

# ── Summary ───────────────────────────────────────────────────────

printf "\n══════════════════════════════════════════════════════════════\n"
printf "  Results: %d passed, %d failed\n" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  printf "\n  Failures:\n"
  printf "$ERRORS\n"
  printf "\n══════════════════════════════════════════════════════════════\n"
  exit 1
else
  printf "══════════════════════════════════════════════════════════════\n"
  exit 0
fi
