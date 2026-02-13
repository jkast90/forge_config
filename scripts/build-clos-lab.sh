#!/bin/bash
# Build a 2-spine / 2-leaf CLOS fabric lab using cEOS containers
#
# Usage: ./scripts/build-clos-lab.sh
#
# Prerequisites:
#   - ceosimage:latest Docker image available
#   - ZTP backend running on localhost:8080
#   - jq installed
#
# The script is idempotent - running it again tears down and rebuilds.

set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
IMAGE="${CEOS_IMAGE:-ceosimage:latest}"
MGMT_NETWORK="${MGMT_NETWORK:-ztp-app_ztp-net}"
TOPOLOGY_ID="dc1-fabric"
TOPOLOGY_NAME="DC1 Fabric"

# Container names
CONTAINERS=(clos-spine-1 clos-spine-2 clos-leaf-1 clos-leaf-2)
HOSTNAMES=(spine-1 spine-2 leaf-1 leaf-2)
ROLES=(spine spine leaf leaf)

# Point-to-point fabric networks
FABRIC_NETS=(clos-s1-l1 clos-s1-l2 clos-s2-l1 clos-s2-l2)

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[x]${NC} $*"; }
step()  { echo -e "\n${CYAN}=== $* ===${NC}"; }

# ── Auth ───────────────────────────────────────────────────────────
step "Authenticating"
TOKEN=$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  err "Failed to authenticate. Is the backend running?"
  exit 1
fi
info "Got JWT token"

api() {
  local method=$1 path=$2; shift 2
  curl -sf -X "$method" "$API_URL$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    "$@"
}

# ── Step 1: Cleanup ───────────────────────────────────────────────
step "Cleaning up existing CLOS lab"

for name in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
    info "Removing container: $name"
    docker stop "$name" 2>/dev/null || true
    docker rm -f "$name" 2>/dev/null || true
  fi
done

for net in "${FABRIC_NETS[@]}"; do
  if docker network ls --format '{{.Name}}' | grep -q "^${net}$"; then
    info "Removing network: $net"
    docker network rm "$net" 2>/dev/null || true
  fi
done

# Clean up devices from the API that belong to this topology
existing_devices=$(api GET "/api/devices" 2>/dev/null || echo "[]")
echo "$existing_devices" | jq -r '.[] | select(.topology_id == "'"$TOPOLOGY_ID"'") | .mac' 2>/dev/null | while read -r mac; do
  if [ -n "$mac" ]; then
    info "Removing device: $mac"
    api DELETE "/api/devices/$mac" 2>/dev/null || true
  fi
done

# Delete the existing topology
api DELETE "/api/topologies/$TOPOLOGY_ID" 2>/dev/null || true
info "Cleanup complete"

# ── Step 2: Create fabric networks ────────────────────────────────
step "Creating fabric point-to-point networks"

for net in "${FABRIC_NETS[@]}"; do
  docker network create "$net" --internal --driver bridge >/dev/null
  info "Created network: $net"
done

# ── Step 3: Create cEOS containers ────────────────────────────────
step "Creating cEOS containers"

# cEOS startup config template
gen_startup_config() {
  local hostname=$1 serial=$2
  cat <<EOF
! device: $hostname
! serial: $serial
! boot system flash:/EOS.swi
!
hostname $hostname
!
spanning-tree mode mstp
!
aaa authorization exec default local
!
no aaa root
!
username admin privilege 15 role network-admin secret 0 admin
!
interface Management0
   no shutdown
!
ip routing
!
management api http-commands
   no shutdown
!
management ssh
   idle-timeout 120
   authentication mode password
   no shutdown
!
end
EOF
}

# modprobe wrapper (Docker Desktop has no /lib/modules)
MODPROBE_WRAPPER='#!/bin/sh
exit 0'

declare -A CONTAINER_IPS
declare -A CONTAINER_MACS

for i in "${!CONTAINERS[@]}"; do
  name="${CONTAINERS[$i]}"
  hostname="${HOSTNAMES[$i]}"

  info "Creating $name (hostname: $hostname)..."

  # Generate a random MAC with locally-administered bit
  mac=$(printf '02:%02x:%02x:%02x:%02x:%02x' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))

  serial="SN-CLOS-${hostname}"

  # Create the container (stopped)
  docker create \
    --name "$name" \
    --hostname "$hostname" \
    --privileged \
    --network "$MGMT_NETWORK" \
    --mac-address "$mac" \
    --device /dev/net/tun:/dev/net/tun \
    --label "ztp-test-client=true" \
    --label "ztp-ceos=true" \
    --label "ztp-clos=$TOPOLOGY_ID" \
    -e "CEOS=1" \
    -e "container=docker" \
    -e "INTFTYPE=eth" \
    -e "ETBA=1" \
    -e "SKIP_STARTUP_CONFIG=false" \
    -e "AUTOCONFIGURE=dhcp" \
    -e "MAPETH0=1" \
    --entrypoint "/bin/bash" \
    "$IMAGE" \
    -c 'mknod -m 600 /dev/console c 5 1 2>/dev/null; exec /sbin/init systemd.setenv=INTFTYPE=eth systemd.setenv=ETBA=1 systemd.setenv=CEOS=1 systemd.setenv=container=docker' \
    >/dev/null

  # Inject startup-config via temp file
  tmpdir=$(mktemp -d)
  gen_startup_config "$hostname" "$serial" > "$tmpdir/startup-config"
  docker cp "$tmpdir/startup-config" "$name:/mnt/flash/startup-config"

  # Inject modprobe wrapper
  echo "$MODPROBE_WRAPPER" > "$tmpdir/modprobe"
  chmod +x "$tmpdir/modprobe"
  docker cp "$tmpdir/modprobe" "$name:/sbin/modprobe"
  rm -rf "$tmpdir"

  CONTAINER_MACS[$name]="$mac"
  info "Created $name (mac: $mac)"
done

# ── Step 4: Connect fabric networks (before starting) ────────────
step "Connecting fabric links"

# spine-1: eth1→clos-s1-l1, eth2→clos-s1-l2
docker network connect clos-s1-l1 clos-spine-1
docker network connect clos-s1-l2 clos-spine-1
info "spine-1: eth1→leaf-1, eth2→leaf-2"

# spine-2: eth1→clos-s2-l1, eth2→clos-s2-l2
docker network connect clos-s2-l1 clos-spine-2
docker network connect clos-s2-l2 clos-spine-2
info "spine-2: eth1→leaf-1, eth2→leaf-2"

# leaf-1: eth1→clos-s1-l1, eth2→clos-s2-l1
docker network connect clos-s1-l1 clos-leaf-1
docker network connect clos-s2-l1 clos-leaf-1
info "leaf-1: eth1→spine-1, eth2→spine-2"

# leaf-2: eth1→clos-s1-l2, eth2→clos-s2-l2
docker network connect clos-s1-l2 clos-leaf-2
docker network connect clos-s2-l2 clos-leaf-2
info "leaf-2: eth1→spine-1, eth2→spine-2"

# ── Step 5: Start containers ─────────────────────────────────────
step "Starting cEOS containers"

for name in "${CONTAINERS[@]}"; do
  docker start "$name" >/dev/null
  info "Started $name"
done

# Wait a moment for Docker to assign IPs
sleep 3

# Get IPs from management network
for name in "${CONTAINERS[@]}"; do
  ip=$(docker inspect "$name" --format "{{(index .NetworkSettings.Networks \"$MGMT_NETWORK\").IPAddress}}" 2>/dev/null || echo "")
  CONTAINER_IPS[$name]="$ip"
  info "$name → $ip"
done

# ── Step 6: Create topology & register devices ────────────────────
step "Creating topology and registering devices"

# Create the topology
api POST "/api/topologies" -d "$(jq -n \
  --arg id "$TOPOLOGY_ID" \
  --arg name "$TOPOLOGY_NAME" \
  --arg desc "2-spine 2-leaf CLOS lab with cEOS $IMAGE" \
  '{id: $id, name: $name, description: $desc}')" >/dev/null
info "Created topology: $TOPOLOGY_NAME ($TOPOLOGY_ID)"

# Register each device
for i in "${!CONTAINERS[@]}"; do
  name="${CONTAINERS[$i]}"
  hostname="${HOSTNAMES[$i]}"
  role="${ROLES[$i]}"
  mac="${CONTAINER_MACS[$name]}"
  ip="${CONTAINER_IPS[$name]}"

  if [ -z "$ip" ]; then
    warn "Skipping $name — no IP assigned"
    continue
  fi

  # Create the device
  api POST "/api/devices" -d "$(jq -n \
    --arg mac "$mac" \
    --arg ip "$ip" \
    --arg hostname "$hostname" \
    --arg vendor "arista" \
    --arg model "cEOS-lab" \
    --arg serial "SN-CLOS-${hostname}" \
    --arg topology_id "$TOPOLOGY_ID" \
    --arg topology_role "$role" \
    '{mac: $mac, ip: $ip, hostname: $hostname, vendor: $vendor, model: $model, serial_number: $serial, topology_id: $topology_id, topology_role: $topology_role}')" >/dev/null 2>&1 || true

  info "Registered $hostname ($mac → $ip) as $role"
done

# ── Step 7: Summary ──────────────────────────────────────────────
step "CLOS Lab Ready"

echo ""
printf "%-14s %-19s %-15s %-8s\n" "HOSTNAME" "MAC" "IP" "ROLE"
printf "%-14s %-19s %-15s %-8s\n" "--------" "---" "--" "----"
for i in "${!CONTAINERS[@]}"; do
  name="${CONTAINERS[$i]}"
  hostname="${HOSTNAMES[$i]}"
  role="${ROLES[$i]}"
  mac="${CONTAINER_MACS[$name]}"
  ip="${CONTAINER_IPS[$name]}"
  printf "%-14s %-19s %-15s %-8s\n" "$hostname" "$mac" "$ip" "$role"
done

echo ""
info "Topology: $TOPOLOGY_NAME ($TOPOLOGY_ID)"
info "cEOS takes ~60-90s to fully boot. SSH: ssh admin@<ip> (password: admin)"
info "Check UI: Topologies page should show 2 spines + 2 leaves"
echo ""

# Fabric link diagram
echo "Fabric Links:"
echo "  spine-1 eth1 ←→ leaf-1 eth1  (clos-s1-l1)"
echo "  spine-1 eth2 ←→ leaf-2 eth1  (clos-s1-l2)"
echo "  spine-2 eth1 ←→ leaf-1 eth2  (clos-s2-l1)"
echo "  spine-2 eth2 ←→ leaf-2 eth2  (clos-s2-l2)"
