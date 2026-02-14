#!/bin/bash
set -e

echo "========================================"
echo "FRR Container Starting"
echo "========================================"

# Enable IP forwarding (v4 + v6)
sysctl -w net.ipv4.ip_forward=1 2>/dev/null || true
sysctl -w net.ipv6.conf.all.forwarding=1 2>/dev/null || true
sysctl -w net.ipv6.conf.default.forwarding=1 2>/dev/null || true
# Ensure link-local IPv6 addresses are generated on all interfaces
sysctl -w net.ipv6.conf.all.disable_ipv6=0 2>/dev/null || true
sysctl -w net.ipv6.conf.default.disable_ipv6=0 2>/dev/null || true

# Get our info
MAC=$(ip link show eth0 | grep ether | awk '{print $2}')
echo "MAC Address: $MAC"

# Set hostname if provided
if [ -n "$DEVICE_HOSTNAME" ]; then
    hostname "$DEVICE_HOSTNAME"
    echo "Hostname: $DEVICE_HOSTNAME"
fi

# Start SSH
echo "Starting SSH server..."
/usr/sbin/sshd -E /var/log/sshd.log

# Wait for network
sleep 2
IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
echo "Management IP: $IP"

# Create log directory
mkdir -p /var/log/frr
chown frr:frr /var/log/frr

# Write initial FRR config
HOSTNAME=${DEVICE_HOSTNAME:-$(hostname)}
cat > /etc/frr/frr.conf << EOF
frr defaults traditional
hostname $HOSTNAME
log syslog informational
service integrated-vtysh-config
!
end
EOF

chown frr:frr /etc/frr/frr.conf

# Start FRR
echo "Starting FRR daemons..."
/usr/lib/frr/frrinit.sh start

sleep 1

# Show status
echo ""
echo "FRR Container Ready"
echo "  SSH: ssh admin@$IP (password: admin)"
echo "  vtysh: vtysh (from shell)"
echo ""

# List all interfaces
echo "Interfaces:"
ip -br addr show
echo ""

echo "Waiting for connections..."

# Background: enable IPv6 on fabric interfaces as they appear
(
  while true; do
    for iface in eth1 eth2 eth3 eth4; do
      if ip link show "$iface" > /dev/null 2>&1; then
        sysctl -qw "net.ipv6.conf.${iface}.disable_ipv6=0" 2>/dev/null || true
      fi
    done
    sleep 5
  done
) &

# Keep running
sleep infinity
