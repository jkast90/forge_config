# ZTP Server

A containerized Zero Touch Provisioning server for network devices with web and mobile management interfaces.

## Overview

ZTP Server automates the provisioning of network devices by:
- Assigning IP addresses via DHCP based on MAC address
- Serving device-specific configurations via TFTP or HTTP
- Automatically backing up device configs after provisioning
- Providing web and mobile interfaces for device management

## Features

- **DHCP Server** - Static IP assignment based on MAC address using dnsmasq, with configurable DHCP options per vendor
- **TFTP / HTTP Config Server** - Serves templated configuration files to network devices via TFTP or HTTP
- **Config Backup** - Automatically SSHs into devices after provisioning to backup running configs
- **Web UI** - React-based interface for managing devices, templates, vendors, groups, IPAM, and more
- **Mobile App** - React Native (Expo) app with barcode scanner for easy device onboarding
- **REST API** - Full API for automation and integration
- **Vendor Management** - Define vendor profiles with MAC prefixes, default templates, SSH settings, custom DHCP options, and quick actions
- **Device Variables** - Per-device and per-group key-value variables for template rendering (Ansible-style inheritance)
- **Groups** - Hierarchical device groups with variable inheritance and precedence
- **IPAM** - IP Address Management with regions, locations, datacenters, prefixes, IP addresses, roles, and tags
- **Topologies** - CLOS fabric topology management with super-spine/spine/leaf roles
- **DHCP Options** - Configurable DHCP options (Option 43, 60, 66, 67, 125, 150, etc.) with per-vendor scoping
- **Device Discovery** - Automatic detection of new devices via DHCP lease monitoring with rich metadata capture (vendor class, circuit ID, relay info)
- **Config Deploy** - Push configs to devices over SSH, with preview and diff support
- **Remote Execution** - Run ad-hoc commands on devices via SSH
- **Docker Lab** - Spawn and manage test containers from the UI, including automated CLOS lab builds
- **NetBox Integration** - Bidirectional sync of devices and vendors with NetBox
- **Templatizer** - Convert raw device configs into reusable Tera templates
- **Jobs** - Async job queue for long-running operations (command execution, config deploys)
- **WebSocket** - Real-time event streaming for discovery, status changes, and job progress
- **JWT Authentication** - Secure API access with token-based auth
- **Themes** - 14 built-in themes including dark, light, solarized, dracula, nord, and more
- **OpenGear Support** - Built-in support for OpenGear Lighthouse ZTP enrollment

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend/mobile development)
- Expo Go app on your phone (for mobile testing)

### 1. Start the Server

```bash
git clone <repo-url>
cd ztp-app
docker compose up

# Verify it's running
curl http://localhost:8080/api/devices
```

### 2. Access the Web UI

Open http://localhost:5174 in your browser (Vite dev server proxies to the Rust backend on port 8080).

### 3. Configure Settings

1. Click the **Settings** icon (gear) in the header
2. Set your default SSH credentials for device backup
3. Configure DHCP range and gateway settings
4. (Optional) Configure OpenGear Lighthouse enrollment

### 4. Add Your First Device

1. Click **Add Device**
2. Enter the device's MAC address, desired IP, and hostname
3. Select a vendor and config template
4. Click **Add Device**

The device will receive its IP and config on next boot.

---

## Mobile App Setup

The mobile app lets you manage devices from your phone and scan barcodes/QR codes to quickly add device serial numbers.

### Development Setup

```bash
cd mobile
npm install
npm start
```

### Configure API Connection

Edit `mobile/src/config.ts` to set your server's IP address:

```typescript
export const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:8080'  // Your computer's local IP
  : 'http://your-production-server:8080';
```

### Running on Your Phone

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android)
2. Make sure your phone is on the same WiFi network as your computer
3. Run `npm start` in the mobile directory
4. Scan the QR code with Expo Go (Android) or Camera app (iOS)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
├──────────────────┬──────────────────┬───────────────────────────┤
│   DHCP Server    │   TFTP Server    │   API + Web UI            │
│   (dnsmasq)      │   (dnsmasq)      │   (Rust/Axum + React)     │
│   Port 67/udp    │   Port 69/udp    │   Port 8080 / 5174        │
├──────────────────┴──────────────────┴───────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  SQLite DB  │  │  WebSocket   │  │  Docker Engine         │  │
│  │  Devices    │  │  Real-time   │  │  Test containers       │  │
│  │  Templates  │  │  events &    │  │  CLOS lab topology     │  │
│  │  Vendors    │  │  discovery   │  │  FRR routing clients   │  │
│  │  Groups     │  │              │  │                        │  │
│  │  IPAM       │  │              │  │                        │  │
│  │  Jobs       │  │              │  │                        │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Backup     │  │  Discovery   │  │  NetBox Integration    │  │
│  │  Service    │  │  Service     │  │  Bidirectional sync    │  │
│  │  (SSH)      │  │  (Leases)    │  │  Devices & vendors     │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
ztp-app/
├── backend-rust/              # Rust API server (Axum)
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── router.rs          # Route definitions
│   │   ├── auth.rs            # JWT authentication
│   │   ├── handlers/          # HTTP endpoint handlers
│   │   │   ├── devices.rs     # Device CRUD + connect/deploy/exec
│   │   │   ├── templates.rs   # Template CRUD + preview
│   │   │   ├── vendors.rs     # Vendor & vendor action CRUD
│   │   │   ├── groups.rs      # Groups, members, variables
│   │   │   ├── device_variables.rs  # Per-device KV variables
│   │   │   ├── ipam.rs        # IPAM regions/locations/prefixes/IPs
│   │   │   ├── topologies.rs  # Topology CRUD
│   │   │   ├── dhcp_options.rs # DHCP option management
│   │   │   ├── backups.rs     # Backup trigger & listing
│   │   │   ├── discovery.rs   # Device discovery & logs
│   │   │   ├── docker.rs      # Container spawn & CLOS lab
│   │   │   ├── netbox.rs      # NetBox sync endpoints
│   │   │   ├── jobs.rs        # Async job queue
│   │   │   ├── settings.rs    # Global settings
│   │   │   ├── configs.rs     # HTTP config server
│   │   │   └── benchmarks.rs  # Performance benchmarks
│   │   ├── db/                # SQLite data layer
│   │   ├── dhcp/              # dnsmasq config generation & lease watching
│   │   ├── backup/            # SSH backup service
│   │   ├── ws/                # WebSocket hub for real-time events
│   │   ├── status/            # Device status checker
│   │   ├── jobs/              # Job service for async operations
│   │   ├── services/          # Business logic services
│   │   ├── netbox/            # NetBox API client
│   │   ├── models/            # Data structures
│   │   ├── config/            # Configuration loading
│   │   └── utils/             # Utility functions
│   ├── migrations/            # SQL database migrations
│   ├── Cargo.toml
│   ├── Dockerfile             # Production build
│   └── Dockerfile.dev         # Development build
│
├── frontend/                  # React web UI (Vite + TypeScript)
│   └── src/
│       ├── components/        # UI components (56+)
│       ├── context/           # React contexts
│       └── core -> ../../shared/core
│
├── mobile/                    # React Native app (Expo)
│   └── src/
│       ├── screens/           # App screens (16+)
│       ├── components/        # Mobile UI components (26+)
│       ├── navigation/        # React Navigation setup
│       ├── hooks/             # Custom hooks
│       └── core -> ../../shared/core
│
├── shared/                    # Shared code between web and mobile
│   └── core/
│       ├── types.ts           # TypeScript interfaces
│       ├── services/          # API service layer (19 modules)
│       ├── hooks/             # React hooks (34+)
│       ├── store/             # Redux store
│       ├── theme/             # Theme definitions
│       ├── utils/             # Validation & formatting
│       └── constants/         # App constants
│
├── test-client/               # Simulated network switch for testing
├── frr-client/                # FRR (Free Range Routing) test client
├── configs/templates/         # Device config templates
├── scripts/                   # Build & lab scripts
├── docker-compose.yml         # Main Docker Compose
├── docker-compose.dev.yml     # Development override
└── docker-compose.netbox.yml  # NetBox integration compose
```

---

## ZTP Flow

```
1. Device boots
        │
        ▼
2. DHCP Request ──────────► ZTP Server assigns IP based on MAC
        │                    (vendor-specific DHCP options applied)
        ▼
3. TFTP/HTTP Request ─────► ZTP Server serves device-specific config
        │                    (template rendered with device + group variables)
        ▼
4. Device applies config and comes online
        │
        ▼
5. ZTP Server detects lease ──► Waits for backup delay
        │
        ▼
6. SSH to device ──────────► Runs vendor-specific backup command
        │
        ▼
7. Config saved to /backups/{hostname}_{timestamp}.cfg
```

---

## API Reference

> Full OpenAPI 3.1 specification: [`openapi.yaml`](openapi.yaml)

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login and receive JWT token |

Include the token in subsequent requests: `Authorization: Bearer <token>`

### Devices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices` | List all devices |
| POST | `/api/devices` | Create a new device |
| GET | `/api/devices/:mac` | Get device by MAC |
| PUT | `/api/devices/:mac` | Update device |
| DELETE | `/api/devices/:mac` | Delete device |
| POST | `/api/devices/:mac/connect` | Test SSH connectivity |
| GET | `/api/devices/:mac/config` | Get rendered config |
| POST | `/api/devices/:mac/preview-config` | Preview config with variables |
| POST | `/api/devices/:mac/deploy-config` | Deploy config over SSH |
| POST | `/api/devices/:mac/exec` | Execute command on device |

### Device Variables

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:mac/variables` | List device variables |
| PUT | `/api/devices/:mac/variables` | Set all device variables |
| PUT | `/api/devices/:mac/variables/:key` | Set a single variable |
| DELETE | `/api/devices/:mac/variables/:key` | Delete a variable |
| GET | `/api/variables/keys` | List all variable keys |
| DELETE | `/api/variables/keys/:key` | Delete a key from all devices |
| GET | `/api/variables/by-key/:key` | List all values for a key |
| POST | `/api/variables/bulk` | Bulk set variables |
| GET | `/api/devices/:mac/resolved-variables` | Get resolved variables (with group inheritance) |

### Groups

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/groups` | List all groups |
| POST | `/api/groups` | Create a group |
| GET | `/api/groups/:id` | Get group |
| PUT | `/api/groups/:id` | Update group |
| DELETE | `/api/groups/:id` | Delete group |
| GET | `/api/groups/:id/variables` | List group variables |
| PUT | `/api/groups/:id/variables/:key` | Set group variable |
| DELETE | `/api/groups/:id/variables/:key` | Delete group variable |
| GET | `/api/groups/:id/members` | List group members |
| PUT | `/api/groups/:id/members` | Set all group members |
| PUT | `/api/groups/:id/members/:mac` | Add member to group |
| DELETE | `/api/groups/:id/members/:mac` | Remove member from group |
| GET | `/api/devices/:mac/groups` | List groups for a device |
| PUT | `/api/devices/:mac/groups` | Set groups for a device |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates` | List all templates |
| POST | `/api/templates` | Create a template |
| GET | `/api/templates/:id` | Get template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| POST | `/api/templates/:id/preview` | Preview rendered template |
| GET | `/api/templates/_/variables` | List template variables |

### Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List all vendors |
| POST | `/api/vendors` | Create a vendor |
| GET | `/api/vendors/defaults` | Get built-in default vendors |
| GET | `/api/vendors/:id` | Get vendor |
| PUT | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |
| GET | `/api/vendors/:id/actions` | List vendor actions |

### Vendor Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendor-actions` | List all vendor actions |
| POST | `/api/vendor-actions` | Create a vendor action |
| PUT | `/api/vendor-actions/:id` | Update vendor action |
| DELETE | `/api/vendor-actions/:id` | Delete vendor action |

### Topologies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/topologies` | List all topologies |
| POST | `/api/topologies` | Create a topology |
| GET | `/api/topologies/:id` | Get topology |
| PUT | `/api/topologies/:id` | Update topology |
| DELETE | `/api/topologies/:id` | Delete topology |

### DHCP Options

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dhcp-options` | List all DHCP options |
| POST | `/api/dhcp-options` | Create a DHCP option |
| GET | `/api/dhcp-options/defaults` | Get default DHCP options |
| GET | `/api/dhcp-options/:id` | Get DHCP option |
| PUT | `/api/dhcp-options/:id` | Update DHCP option |
| DELETE | `/api/dhcp-options/:id` | Delete DHCP option |

### Backups

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/devices/:mac/backup` | Trigger manual backup |
| GET | `/api/devices/:mac/backups` | List backups for device |
| GET | `/api/backups/:id` | Download backup file |

### Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/discovery` | List undiscovered devices |
| GET | `/api/discovery/leases` | List current DHCP leases |
| GET | `/api/discovery/logs` | List discovery event logs |
| DELETE | `/api/discovery/logs` | Clear discovery logs |
| POST | `/api/discovery/clear` | Clear all discovered devices |
| DELETE | `/api/discovery/:mac` | Dismiss a discovered device |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/:id` | Get job status and output |

### Docker / Lab Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docker/containers` | List managed containers |
| POST | `/api/docker/containers` | Spawn a test container |
| DELETE | `/api/docker/containers/:id` | Remove a container |
| POST | `/api/docker/containers/:id/start` | Start a container |
| POST | `/api/docker/containers/:id/restart` | Restart a container |
| POST | `/api/docker/clos-lab` | Build a CLOS lab topology |
| DELETE | `/api/docker/clos-lab` | Tear down CLOS lab |

### IPAM

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ipam/regions` | List regions |
| POST | `/api/ipam/regions` | Create region |
| GET | `/api/ipam/regions/:id` | Get region |
| PUT | `/api/ipam/regions/:id` | Update region |
| DELETE | `/api/ipam/regions/:id` | Delete region |
| GET | `/api/ipam/locations` | List locations |
| POST | `/api/ipam/locations` | Create location |
| GET | `/api/ipam/locations/:id` | Get location |
| PUT | `/api/ipam/locations/:id` | Update location |
| DELETE | `/api/ipam/locations/:id` | Delete location |
| GET | `/api/ipam/datacenters` | List datacenters |
| POST | `/api/ipam/datacenters` | Create datacenter |
| GET | `/api/ipam/datacenters/:id` | Get datacenter |
| PUT | `/api/ipam/datacenters/:id` | Update datacenter |
| DELETE | `/api/ipam/datacenters/:id` | Delete datacenter |
| GET | `/api/ipam/roles` | List roles |
| POST | `/api/ipam/roles` | Create role |
| DELETE | `/api/ipam/roles/:id` | Delete role |
| GET | `/api/ipam/vrfs` | List VRFs |
| POST | `/api/ipam/vrfs` | Create VRF |
| DELETE | `/api/ipam/vrfs/:id` | Delete VRF |
| GET | `/api/ipam/prefixes` | List prefixes |
| GET | `/api/ipam/prefixes/supernets` | List supernets |
| POST | `/api/ipam/prefixes` | Create prefix |
| GET | `/api/ipam/prefixes/:id` | Get prefix |
| PUT | `/api/ipam/prefixes/:id` | Update prefix |
| DELETE | `/api/ipam/prefixes/:id` | Delete prefix |
| POST | `/api/ipam/prefixes/:id/available-prefixes` | Get next available prefix |
| POST | `/api/ipam/prefixes/:id/available-ips` | Get next available IP |
| GET | `/api/ipam/ip-addresses` | List IP addresses |
| POST | `/api/ipam/ip-addresses` | Create IP address |
| GET | `/api/ipam/ip-addresses/:id` | Get IP address |
| PUT | `/api/ipam/ip-addresses/:id` | Update IP address |
| DELETE | `/api/ipam/ip-addresses/:id` | Delete IP address |
| GET | `/api/ipam/tags/keys` | List all tag keys in use |
| GET | `/api/ipam/tags/:type/:id` | List tags for resource |
| POST | `/api/ipam/tags/:type/:id` | Set tag on resource |
| DELETE | `/api/ipam/tags/:type/:id/:key` | Delete tag |

### NetBox Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/netbox/status` | Check NetBox connectivity |
| GET | `/api/netbox/config` | Get NetBox configuration |
| PUT | `/api/netbox/config` | Update NetBox configuration |
| POST | `/api/netbox/sync/push` | Push devices to NetBox |
| POST | `/api/netbox/sync/pull` | Pull devices from NetBox |
| POST | `/api/netbox/sync/vendors/push` | Push vendors to NetBox |
| POST | `/api/netbox/sync/vendors/pull` | Pull vendors from NetBox |
| GET | `/api/netbox/manufacturers` | List NetBox manufacturers |
| GET | `/api/netbox/sites` | List NetBox sites |
| GET | `/api/netbox/device-roles` | List NetBox device roles |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get global settings |
| PUT | `/api/settings` | Update settings |
| POST | `/api/reload` | Reload DHCP/TFTP config |
| GET | `/api/network/addresses` | List local network interfaces |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/api/ws` | Real-time event stream (discovery, status, jobs) |

### Example: Add a Device

```bash
curl -X POST http://localhost:8080/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "mac": "00:11:22:33:44:55",
    "ip": "192.168.1.100",
    "hostname": "switch-01",
    "vendor": "cisco",
    "config_template": "cisco-switch"
  }'
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `/data/ztp.db` | SQLite database path |
| `TFTP_DIR` | `/tftp` | TFTP root directory |
| `BACKUP_DIR` | `/backups` | Config backup directory |
| `TEMPLATES_DIR` | `/configs/templates` | Config templates directory |
| `RUST_LOG` | `info` | Log level |
| `JWT_SECRET` | `change-me-in-production` | Secret for JWT token signing |
| `DOCKER_NETWORK` | `ztp-app_ztp-net` | Docker network for spawned containers |
| `TEST_CLIENT_IMAGE` | `ztp-server-test-client` | Docker image for test containers |

### Settings (via UI or API)

| Setting | Description |
|---------|-------------|
| **Default SSH User** | Username for device backup connections |
| **Default SSH Password** | Password for device backup connections |
| **Backup Command** | Command to run on device (default: `show running-config`) |
| **Backup Delay** | Seconds to wait after lease before backup attempt |
| **DHCP Range Start/End** | IP pool for dynamic assignments |
| **DHCP Subnet** | Subnet mask for DHCP |
| **DHCP Gateway** | Default gateway for DHCP clients |
| **TFTP Server IP** | IP address advertised to clients |
| **OpenGear Enroll URL** | Lighthouse enrollment server address |
| **OpenGear Bundle** | Lighthouse bundle name |
| **OpenGear Password** | Lighthouse enrollment password |

---

## Config Templates

Templates are stored in the database and use [Tera](https://keats.github.io/tera/) syntax (similar to Jinja2). Built-in variables available for rendering:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{Hostname}}` | Device hostname | `switch-01` |
| `{{IP}}` | Assigned IP address | `172.30.0.99` |
| `{{MAC}}` | Device MAC address | `02:42:ac:1e:00:99` |
| `{{Subnet}}` | Subnet mask | `255.255.255.0` |
| `{{Gateway}}` | Default gateway | `172.30.0.1` |
| `{{Vendor}}` | Device vendor | `cisco` |
| `{{SerialNumber}}` | Device serial number | `SN12345` |
| `{{SSHUser}}` | SSH username (if set) | `admin` |
| `{{SSHPass}}` | SSH password (if set) | `password` |
| `{{TopologyId}}` | CLOS topology ID | `dc1-fabric` |
| `{{TopologyRole}}` | CLOS role | `leaf` |
| `{% include "role" %}` | Include role-specific template (e.g., `arista-eos-spine`) | |
| `{{vars.*}}` | Device/group key-value variables | `{{vars.Loopback}}` |

Device and group variables are available under the `vars` namespace (e.g., `{{vars.ntp_server}}`, `{{vars.asn}}`).

### Example: Cisco Switch Template

```
hostname {{Hostname}}
!
interface Vlan1
 ip address {{IP}} {{Subnet}}
 no shutdown
!
ip default-gateway {{Gateway}}
!
ntp server {{vars.ntp_server}}
snmp-server community {{vars.snmp_community}} RO
!
line vty 0 15
 login local
 transport input ssh
!
end
```

### Variable Resolution Order

Variables are resolved with the following precedence (highest wins):

1. **Device variables** - set directly on the device
2. **Group variables** - inherited from groups (ordered by group precedence)
3. **"all" group** - default variables that apply to every device

---

## Testing with Test Client

The included test client simulates a network device going through ZTP:

```bash
# 1. Add the test client's MAC in the UI:
#    MAC: 02:42:ac:1e:00:99
#    IP: 172.30.0.99
#    Hostname: test-switch
#    Template: default template

# 2. Set default SSH credentials in Settings:
#    Username: admin
#    Password: admin

# 3. Start the test client
docker compose --profile test up test-client

# 4. Watch the logs
docker compose logs -f backend-rust test-client
```

### CLOS Lab

You can also build an automated CLOS fabric lab from the Docker management page in the web UI, which spawns spine and leaf containers with pre-configured topology roles.

---

## Development

### Backend (Rust)

```bash
cd backend-rust
cargo build
cargo run
```

### Frontend (React)

```bash
cd frontend
npm install
npm run dev        # Start Vite dev server (port 5174)
npm run build      # Production build
npm run typecheck  # TypeScript type checking
```

### Mobile (React Native)

```bash
cd mobile
npm install
npm start          # Start Expo dev server
npm run ios        # iOS Simulator
npm run android    # Android Emulator
```

### Docker Compose

```bash
docker compose up                    # Start all services
docker compose up --profile test     # Include test client
docker compose up --build            # Rebuild images
docker compose logs -f               # View logs
docker compose logs -f backend-rust  # View backend logs
```

### Shared Core Module

The `shared/core/` directory contains platform-agnostic code shared between web and mobile:

- **types.ts** - TypeScript interfaces for all domain types
- **services/** - API service layer (devices, templates, vendors, groups, IPAM, etc.)
- **hooks/** - React hooks (useDevices, useSettings, useBackups, useTheme, etc.)
- **store/** - Redux store configuration
- **theme/** - Theme definitions (14 themes)
- **utils/** - Validation and formatting utilities

Both `frontend/src/core` and `mobile/src/core` are symlinks to `shared/core/`.

---

## Troubleshooting

### Mobile app can't connect to API

1. Ensure your phone and computer are on the same WiFi network
2. Check that the IP in `mobile/src/config.ts` is correct
3. Verify the API is accessible: `curl http://<your-ip>:8080/api/devices`
4. Check firewall settings allow port 8080

### DHCP not working

1. Check dnsmasq logs: `docker compose logs backend-rust | grep dnsmasq`
2. Verify no other DHCP server is running on the network

### Backup failing

1. Check SSH credentials in Settings (or vendor-specific SSH settings)
2. Verify device is reachable: `ping <device-ip>`
3. Test SSH manually: `ssh admin@<device-ip>`
4. Check backup logs: `docker compose logs backend-rust | grep backup`

### Template not applying

1. Verify template exists in the Templates section of the UI
2. Check that the device has the correct template assigned
3. Look for Tera rendering errors in the logs
4. Ensure required variables are set on the device or its groups

---

## Security Considerations

- Set a strong `JWT_SECRET` in production (via environment variable)
- Change default SSH credentials immediately
- Use strong passwords for OpenGear enrollment
- Consider running behind a reverse proxy with TLS for production
- Restrict API access to trusted networks
- Regularly backup the SQLite database
- The Docker socket is mounted for container management — restrict access accordingly

---

## License

MIT
