#!/bin/bash
# "show running-config" for GoBGP ZTP client
# Returns GoBGP configuration and status

export PATH="/sbin:/usr/sbin:/bin:/usr/bin:/usr/local/bin:$PATH"

# Try gobgp CLI first (daemon running)
if pgrep -x gobgpd > /dev/null 2>&1; then
    echo "# GoBGP Running Configuration"
    echo "# =========================="
    echo ""
    echo "# Global Config:"
    gobgp global 2>/dev/null
    echo ""
    echo "# Neighbors:"
    gobgp neighbor 2>/dev/null
    echo ""
    echo "# Routes (IPv4):"
    gobgp global rib -a ipv4 2>/dev/null
    exit 0
fi

# Fallback: check for downloaded config
CONFIG_FILE=$(ls /config/*.cfg 2>/dev/null | head -1)
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]; then
    echo "# GoBGP Configuration (from ZTP)"
    cat "$CONFIG_FILE"
    exit 0
fi

# Fallback: check gobgpd.conf
if [ -f /etc/gobgp/gobgpd.conf ] && [ -s /etc/gobgp/gobgpd.conf ]; then
    echo "# GoBGP Configuration"
    cat /etc/gobgp/gobgpd.conf
    exit 0
fi

# Last resort
HOSTNAME=$(hostname)
IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
MAC=$(ip link show eth0 2>/dev/null | grep ether | awk '{print $2}')

cat << EOF
# GoBGP Configuration for $HOSTNAME
# Generated: $(date)
# MAC: $MAC
#
global:
  config:
    as: 65000
    router-id: ${IP:-0.0.0.0}
    port: 179
EOF
