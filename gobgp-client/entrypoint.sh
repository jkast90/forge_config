#!/bin/bash
set -e

echo "========================================"
echo "GoBGP ZTP Client Starting"
echo "========================================"

# Get our MAC address
MAC=$(ip link show eth0 | grep ether | awk '{print $2}')
echo "MAC Address: $MAC"

# Start SSH server in background
echo "Starting SSH server..."
dropbear -R -F -E -p 22 &
SSH_PID=$!

# Wait a moment for network to be ready
sleep 2

# Generate dhclient.conf with vendor class identifier
DHCLIENT_CONF="/etc/dhcp/dhclient.conf"
mkdir -p /etc/dhcp

cat > "$DHCLIENT_CONF" << 'EOF'
# Request standard options
request subnet-mask, broadcast-address, routers, domain-name-servers,
        host-name, domain-name, interface-mtu,
        tftp-server-name, bootfile-name, vendor-encapsulated-options;
EOF

# Add hostname if provided
if [ -n "$DEVICE_HOSTNAME" ]; then
    echo "send host-name \"$DEVICE_HOSTNAME\";" >> "$DHCLIENT_CONF"
    echo "Setting DHCP hostname: $DEVICE_HOSTNAME"
fi

# Set vendor class identifier (Option 60)
if [ -n "$VENDOR_CLASS" ]; then
    echo "send vendor-class-identifier \"$VENDOR_CLASS\";" >> "$DHCLIENT_CONF"
    echo "Setting DHCP vendor class: $VENDOR_CLASS"
fi

# Add user class if provided (Option 77)
if [ -n "$USER_CLASS" ]; then
    echo "send user-class \"$USER_CLASS\";" >> "$DHCLIENT_CONF"
    echo "Setting DHCP user class: $USER_CLASS"
fi

# Add client identifier if provided
if [ -n "$CLIENT_ID" ]; then
    echo "send dhcp-client-identifier \"$CLIENT_ID\";" >> "$DHCLIENT_CONF"
    echo "Setting DHCP client ID: $CLIENT_ID"
fi

echo "DHCP client config:"
cat "$DHCLIENT_CONF"
echo ""

# Request DHCP lease
echo "Requesting DHCP lease..."
dhclient -v -cf "$DHCLIENT_CONF" eth0 2>&1 || true

# Wait for IP
sleep 2

# Show assigned IP
IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)
echo "Assigned IP: $IP"

# Calculate config filename from MAC
CONFIG_FILE=$(echo "$MAC" | tr ':' '_').cfg
echo "Config File: $CONFIG_FILE"

# Determine config fetch method
CONFIG_METHOD=${CONFIG_METHOD:-tftp}
echo "Config Method: $CONFIG_METHOD"

# Server addresses
TFTP_SERVER=${TFTP_SERVER:-172.30.0.2}
HTTP_SERVER=${HTTP_SERVER:-172.30.0.2:8080}

cd /config
CONFIG_FETCHED=false

# Try TFTP if enabled
if [ "$CONFIG_METHOD" = "tftp" ] || [ "$CONFIG_METHOD" = "both" ]; then
    echo ""
    echo "Fetching configuration via TFTP from $TFTP_SERVER..."
    if tftp "$TFTP_SERVER" -c get "$CONFIG_FILE" 2>&1; then
        echo "Configuration received via TFTP!"
        CONFIG_FETCHED=true
    else
        echo "Warning: Could not fetch config from TFTP"
    fi
fi

# Try HTTP if enabled (or as fallback)
if [ "$CONFIG_METHOD" = "http" ] || ([ "$CONFIG_METHOD" = "both" ] && [ "$CONFIG_FETCHED" = "false" ]); then
    echo ""
    echo "Fetching configuration via HTTP from http://$HTTP_SERVER/configs/$CONFIG_FILE..."
    if curl -sf "http://$HTTP_SERVER/configs/$CONFIG_FILE" -o "$CONFIG_FILE" 2>&1; then
        echo "Configuration received via HTTP!"
        CONFIG_FETCHED=true
    else
        echo "Warning: Could not fetch config from HTTP"
    fi
fi

# Apply configuration to GoBGP
if [ "$CONFIG_FETCHED" = "true" ] && [ -f "/config/$CONFIG_FILE" ] && [ -s "/config/$CONFIG_FILE" ]; then
    echo ""
    echo "========================================"
    echo "Applying GoBGP configuration:"
    echo "========================================"
    cat "/config/$CONFIG_FILE"
    echo ""
    echo "========================================"

    # Copy config to GoBGP config directory
    cp "/config/$CONFIG_FILE" /etc/gobgp/gobgpd.conf
else
    echo ""
    echo "No ZTP config received, using default GoBGP configuration"

    # Generate a minimal default config
    cat > /etc/gobgp/gobgpd.conf << GOBGPEOF
global:
  config:
    as: 65000
    router-id: ${IP:-0.0.0.0}
    port: 179
GOBGPEOF
fi

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward 2>/dev/null || true

# Start GoBGP daemon
echo ""
echo "Starting GoBGP daemon..."
gobgpd -f /etc/gobgp/gobgpd.conf -t yaml -p &
GOBGP_PID=$!

# Wait for GoBGP to start
sleep 2

echo ""
echo "========================================"
echo "GoBGP ZTP client is ready."
echo "SSH access: ssh admin@$IP (password: admin)"
echo "Backup command: gobgp global"
echo "GoBGP API: localhost:50051 (gRPC)"
echo "========================================"
echo ""

# Show initial BGP status
gobgp global 2>/dev/null || true
echo ""

# Keep container running
wait $SSH_PID
