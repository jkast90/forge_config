#!/bin/bash
# "show running-config" for FRR ZTP client
# Returns FRR running configuration via vtysh

export PATH="/sbin:/usr/sbin:/bin:/usr/bin:/usr/lib/frr:$PATH"

# Try vtysh first (FRR running)
if pgrep -x zebra > /dev/null 2>&1; then
    vtysh -c "show running-config" 2>/dev/null
    exit 0
fi

# Fallback: check for downloaded config
CONFIG_FILE=$(ls /config/*.cfg 2>/dev/null | head -1)
if [ -n "$CONFIG_FILE" ] && [ -f "$CONFIG_FILE" ] && [ -s "$CONFIG_FILE" ]; then
    cat "$CONFIG_FILE"
    exit 0
fi

# Fallback: check frr.conf
if [ -f /etc/frr/frr.conf ] && [ -s /etc/frr/frr.conf ]; then
    cat /etc/frr/frr.conf
    exit 0
fi

# Last resort: generate minimal output
HOSTNAME=$(hostname)
IP=$(ip addr show eth0 2>/dev/null | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
MAC=$(ip link show eth0 2>/dev/null | grep ether | awk '{print $2}')

cat << EOF
! FRR Configuration for $HOSTNAME
! Generated: $(date)
! MAC: $MAC
!
hostname $HOSTNAME
!
interface eth0
 ip address $IP/24
!
end
EOF
