#!/bin/sh
# dhcp-notify.sh - Called by dnsmasq on DHCP lease events
# Captures DHCP request metadata and writes to a JSON-lines file
#
# Arguments: <action> <mac> <ip> [hostname]
# Environment variables set by dnsmasq (only on add/old events):
#   DNSMASQ_VENDOR_CLASS      - Option 60: vendor class identifier
#   DNSMASQ_SUPPLIED_HOSTNAME - Hostname sent by client
#   DNSMASQ_CLIENT_ID         - Option 61: client identifier (often serial/DUID)
#   DNSMASQ_USER_CLASS0..n    - Option 77: user class strings
#   DNSMASQ_REQUESTED_OPTIONS - Options requested by client (comma-separated numbers)
#   DNSMASQ_TAGS              - All matched dnsmasq tags (space-separated)
#   DNSMASQ_INTERFACE         - Network interface request arrived on
#   DNSMASQ_RELAY_ADDRESS     - DHCP relay IP (if relayed)
#   DNSMASQ_CIRCUIT_ID        - Option 82 sub-option 1: circuit ID (switch port)
#   DNSMASQ_REMOTE_ID         - Option 82 sub-option 2: remote ID (switch MAC/name)
#   DNSMASQ_SUBSCRIBER_ID     - Option 82 sub-option 6: subscriber ID
#   DNSMASQ_CPEWAN_OUI        - CPE WAN OUI (Option 125, enterprise 3561)
#   DNSMASQ_CPEWAN_SERIAL     - CPE WAN serial number
#   DNSMASQ_CPEWAN_CLASS      - CPE WAN device class
#   DNSMASQ_LEASE_EXPIRES     - Unix timestamp of lease expiry
#   DNSMASQ_TIME_REMAINING    - Seconds until lease expires

ACTION="$1"
MAC="$2"
IP="$3"
HOSTNAME="${4:-*}"

DHCP_INFO_FILE="/data/dhcp-info.json"

# Only capture on add/old events (metadata is only available then)
case "$ACTION" in
    add|old)
        TIMESTAMP=$(date +%s)

        # Build JSON manually - only include non-empty fields
        # Start with required fields
        JSON="{\"mac\":\"$MAC\",\"ip\":\"$IP\",\"hostname\":\"$HOSTNAME\",\"action\":\"$ACTION\",\"timestamp\":$TIMESTAMP"

        # DHCP Option 60: Vendor Class
        if [ -n "$DNSMASQ_VENDOR_CLASS" ]; then
            JSON="$JSON,\"vendor_class\":\"$DNSMASQ_VENDOR_CLASS\""
        fi

        # Client-supplied hostname (may differ from lease hostname)
        if [ -n "$DNSMASQ_SUPPLIED_HOSTNAME" ]; then
            JSON="$JSON,\"supplied_hostname\":\"$DNSMASQ_SUPPLIED_HOSTNAME\""
        fi

        # DHCP Option 61: Client ID (often serial number or DUID)
        if [ -n "$DNSMASQ_CLIENT_ID" ]; then
            JSON="$JSON,\"client_id\":\"$DNSMASQ_CLIENT_ID\""
        fi

        # DHCP Option 77: User Class (may contain model/firmware info)
        # Collect all user class entries
        USER_CLASSES=""
        i=0
        while true; do
            eval "UC=\${DNSMASQ_USER_CLASS${i}:-}"
            if [ -z "$UC" ]; then
                break
            fi
            if [ -n "$USER_CLASSES" ]; then
                USER_CLASSES="$USER_CLASSES,$UC"
            else
                USER_CLASSES="$UC"
            fi
            i=$((i + 1))
        done
        if [ -n "$USER_CLASSES" ]; then
            JSON="$JSON,\"user_class\":\"$USER_CLASSES\""
        fi

        # Requested DHCP options (fingerprinting)
        if [ -n "$DNSMASQ_REQUESTED_OPTIONS" ]; then
            JSON="$JSON,\"requested_options\":\"$DNSMASQ_REQUESTED_OPTIONS\""
        fi

        # Matched tags
        if [ -n "$DNSMASQ_TAGS" ]; then
            JSON="$JSON,\"tags\":\"$DNSMASQ_TAGS\""
        fi

        # Interface
        if [ -n "$DNSMASQ_INTERFACE" ]; then
            JSON="$JSON,\"interface\":\"$DNSMASQ_INTERFACE\""
        fi

        # Relay agent info (Option 82)
        if [ -n "$DNSMASQ_RELAY_ADDRESS" ]; then
            JSON="$JSON,\"relay_address\":\"$DNSMASQ_RELAY_ADDRESS\""
        fi
        if [ -n "$DNSMASQ_CIRCUIT_ID" ]; then
            JSON="$JSON,\"circuit_id\":\"$DNSMASQ_CIRCUIT_ID\""
        fi
        if [ -n "$DNSMASQ_REMOTE_ID" ]; then
            JSON="$JSON,\"remote_id\":\"$DNSMASQ_REMOTE_ID\""
        fi
        if [ -n "$DNSMASQ_SUBSCRIBER_ID" ]; then
            JSON="$JSON,\"subscriber_id\":\"$DNSMASQ_SUBSCRIBER_ID\""
        fi

        # CPE WAN management (Option 125, enterprise 3561)
        if [ -n "$DNSMASQ_CPEWAN_OUI" ]; then
            JSON="$JSON,\"cpewan_oui\":\"$DNSMASQ_CPEWAN_OUI\""
        fi
        if [ -n "$DNSMASQ_CPEWAN_SERIAL" ]; then
            JSON="$JSON,\"cpewan_serial\":\"$DNSMASQ_CPEWAN_SERIAL\""
        fi
        if [ -n "$DNSMASQ_CPEWAN_CLASS" ]; then
            JSON="$JSON,\"cpewan_class\":\"$DNSMASQ_CPEWAN_CLASS\""
        fi

        # Lease timing
        if [ -n "$DNSMASQ_LEASE_EXPIRES" ]; then
            JSON="$JSON,\"lease_expires\":$DNSMASQ_LEASE_EXPIRES"
        fi
        if [ -n "$DNSMASQ_TIME_REMAINING" ]; then
            JSON="$JSON,\"time_remaining\":$DNSMASQ_TIME_REMAINING"
        fi

        # Close JSON and write
        JSON="$JSON}"
        printf '%s\n' "$JSON" >> "$DHCP_INFO_FILE"
        ;;
esac

exit 0
