# ForgeConfig

A containerized network device provisioning and infrastructure management server with web and mobile interfaces.

## Overview

ForgeConfig automates the provisioning and management of network infrastructure by:
- Assigning IP addresses via DHCP based on MAC address
- Serving device-specific configurations via TFTP or HTTP
- Building datacenter topologies (CLOS and hierarchical) with GPU cluster support
- Managing IP address space, physical locations, and multi-tenant resources
- Automatically backing up device configs after provisioning
- Providing web and mobile interfaces for full infrastructure management

## Features

- **DHCP Server** - Static IP assignment based on MAC address using dnsmasq, with configurable DHCP options per vendor
- **TFTP / HTTP Config Server** - Serves templated configuration files to network devices via TFTP or HTTP
- **Config Backup** - Automatically SSHs into devices after provisioning to backup running configs
- **Config Deploy** - Push configs to devices over SSH, with preview and diff support
- **Remote Execution** - Run ad-hoc commands on devices via SSH
- **Web UI** - React-based interface for managing devices, templates, vendors, groups, IPAM, topologies, and more
- **Mobile App** - React Native (Expo) app with barcode scanner for easy device onboarding
- **REST API** - Full API with 200+ endpoints for automation and integration
- **Vendor Management** - Define vendor profiles with MAC prefixes, default templates, SSH settings, custom DHCP options, and quick actions
- **Device Variables** - Per-device and per-group key-value variables for template rendering (Ansible-style inheritance)
- **Groups** - Hierarchical device groups with variable inheritance and precedence
- **IPAM** - IP Address Management with prefixes, IP addresses, VRFs, roles, and tags
- **Locations** - Physical hierarchy with regions, campuses, datacenters, halls, rows, and racks
- **Topologies** - CLOS fabric and hierarchical (3-tier) topology builders with super-spine/spine/leaf/core/distribution/access roles, visual diagrams, and physical rack placement
- **GPU Clusters** - Attach GPU compute clusters to topologies with configurable models, interconnects (InfiniBand, etc.), VRF isolation, and automatic leaf uplink port assignments
- **Management Switches** - Auto-generated management switch placement with per-row, per-rack, or per-hall distribution strategies
- **Tenants & VRFs** - Multi-tenant resource management with VRF-based network segmentation
- **Topology Downloads** - Export cutsheet (CSV), BOM (CSV), rack sheet (XLSX), and SVG topology diagrams
- **DHCP Options** - Configurable DHCP options (Option 43, 60, 66, 67, 125, 150, etc.) with per-vendor scoping
- **Device Discovery** - Automatic detection of new devices via DHCP lease monitoring with rich metadata capture (vendor class, circuit ID, relay info)
- **Docker Lab** - Spawn and manage test containers from the UI, including automated CLOS lab builds with FRR routing
- **Topology Builder** - Create topology device records with IPAM integration and rack placement (without Docker containers)
- **Device Models** - Hardware model definitions with port layouts and chassis visualization
- **Device Roles** - Role-based template assignment with multiple templates per role
- **Port Assignments** - Per-port configuration with remote device linking, cable lengths, VRF assignments, and patch panel routing
- **Credentials** - Reusable SSH and API key credential storage
- **Job System** - Async job queue for command execution, config deploys, and webhooks with real-time WebSocket updates
- **Job Templates** - Reusable job definitions with cron scheduling and group targeting
- **Vendor Actions** - Per-vendor SSH commands and webhook integrations with variable substitution
- **Output Parsers** - Regex-based extraction of structured data from command output
- **NetBox Integration** - Bidirectional sync of devices and vendors with NetBox
- **Templatizer** - Convert raw device configs into reusable Tera templates
- **Hostname Patterns** - Configurable hostname auto-generation with `$datacenter`, `$region`, `$hall`, `$role`, and `#` variables
- **WebSocket** - Real-time event streaming for discovery, status changes, and job progress
- **JWT Authentication** - Secure API access with token-based auth and user management
- **Themes** - 14 built-in themes including dark, light, solarized, dracula, nord, evergreen, ocean, nautical, and high-contrast variants
- **Branding** - Custom application name and logo
- **OpenGear Support** - Built-in support for OpenGear Lighthouse ZTP enrollment
- **Notifications** - In-app notification center with history and action links
- **ScratchPad** - Persistent notes accessible from the header
- **QR / Barcode Generator** - Generate QR codes and barcodes for device serial numbers or URLs
- **API History** - Request/response logging for debugging
- **Telemetry** - Feature usage analytics and page navigation tracking
- **Help Tour** - Interactive guided tour of the application

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for frontend/mobile development)
- Expo Go app on your phone (for mobile testing)

### 1. Start the Server

```bash
git clone <repo-url>
cd forge-config
docker compose up

# Verify it's running
curl http://localhost:8080/api/devices
```

### 2. Access the Web UI

Open http://localhost:5174 in your browser (Vite dev server proxies to the Rust backend on port 8080).

### 3. Configure Settings

1. Click the **Settings** icon (gear) in the footer
2. Set your default SSH credentials for device backup
3. Configure DHCP range and gateway settings
4. (Optional) Configure OpenGear Lighthouse enrollment
5. (Optional) Set a custom hostname pattern

### 4. Add Your First Device

1. Navigate to the **Devices** page
2. Click **Add Device**
3. Enter the device's MAC address, desired IP, and hostname
4. Select a vendor and config template
5. Click **Add Device**

The device will receive its IP and config on next boot.

---

## Web UI Pages & Tabs

The web UI has 11 primary pages, each with tabbed sub-sections:

### Dashboard
Overview of device status (online/offline/provisioning counts), recent devices, pending discoveries, topology and IPAM metrics, recent job statistics, feature overview cards with live counts, and quick action buttons.

### Devices
| Tab | Description |
|-----|-------------|
| **Devices** | Device list with CRUD, SSH connectivity testing, config preview/deploy/diff, remote command execution, backup triggering, and expandable row details |
| **Discovery** | Discovered-but-unprovisioned devices from DHCP lease monitoring with one-click provisioning, vendor identification via MAC OUI, circuit ID, relay info, and vendor class metadata |
| **Test Containers** | Spawn, start, stop, and restart Docker test host containers for lab testing |

### Configuration
| Tab | Description |
|-----|-------------|
| **Templates** | Tera template editor with syntax highlighting, variable extraction, and preview rendering |
| **Roles** | Device role definitions that assign one or more templates based on network function |
| **Groups** | Hierarchical device groups with parent-child relationships, bulk membership, and group-level variables |
| **Variables** | Per-device key-value variable management with bulk operations |
| **Inspector** | Resolved variables preview showing final merged values for any device (device + group + "all" group inheritance) |
| **Credentials** | SSH and API key credential storage for use in jobs and actions |

### Jobs
| Tab | Description |
|-----|-------------|
| **Actions** | Vendor-specific SSH commands and webhook/API integrations with variable substitution and output parsing |
| **Job History** | Execution logs with real-time WebSocket status updates, output viewing, duration tracking, and re-launch |
| **Templates** | Reusable job template definitions with device/group targeting and cron scheduling |
| **Credentials** | Shared credential panel (same as Configuration > Credentials) |
| **Output Parsers** | Regex-based output extraction with named capture groups for structured result display |

### Topologies
Topology table with expandable rows showing device assignments by role. Features include:
- **CLOS fabric** (spine/leaf/super-spine) and **hierarchical** (core/distribution/access) architectures
- **GPU cluster** integration with VRF isolation, configurable models and interconnects
- **Management switch** placement with per-row, per-rack, or per-hall distribution
- **Topology preview** with device hostnames, IP assignments, rack placement, and cabling before deploy
- Physical placement integration with **datacenter, halls, rows, and racks**
- **Visual topology diagrams** in the expanded row
- Docker-based CLOS lab builds with FRR routing
- Per-device **config preview, deploy, diff**, and command execution
- **Port assignment** management with chassis visualization
- Download **cutsheet** (CSV), **BOM** (CSV), **rack sheet** (XLSX), and **SVG export**
- Add/swap/remove devices per role

### IPAM (IP Address Management)
| Tab | Description |
|-----|-------------|
| **Prefixes** | Network prefix hierarchy with supernets, subnets, next-available-prefix/IP allocation, VRF and datacenter association |
| **IP Addresses** | Individual IP address assignments with device association, DNS names, and status tracking |
| **Roles** | Prefix and IP address role categorization |

### Locations
| Tab | Description |
|-----|-------------|
| **Regions** | Geographic regions |
| **Campuses** | Campus-level organization within regions |
| **Datacenters** | Datacenter facilities within campuses |
| **Halls** | Datacenter halls within datacenters |
| **Rows** | Equipment rows within halls |
| **Racks** | Physical racks with device assignments and rack unit positioning |

### Tenants
| Tab | Description |
|-----|-------------|
| **Tenants** | Multi-tenant organization management with status tracking |
| **VRFs** | Virtual Routing and Forwarding instances for network segmentation, associated with tenants |
| **GPU Clusters** | GPU compute cluster management with model, node count, interconnect type, VRF, and topology association |

### Vendors & Models
| Tab | Description |
|-----|-------------|
| **Vendors** | Vendor profiles with MAC OUI prefixes, default templates, SSH settings, and quick actions |
| **DHCP Options** | DHCP option definitions (43, 60, 66, 67, 125, 150, etc.) with per-vendor scoping and sub-option support |
| **Device Models** | Hardware model definitions with port layouts and chassis preview visualization |

### System
| Tab | Description |
|-----|-------------|
| **Users** | User management (create, edit, enable/disable, delete) |
| **Branding** | Application name and logo customization |
| **Device Naming** | Hostname pattern configuration (`$datacenter-$region-$hall-$role-#`) with live preview |

### Data Explorer
Redux store inspector with real-time JSON tree navigation for debugging application state.

### Additional UI Features

- **Settings Dialog** - Global settings for SSH defaults, DHCP, backup, OpenGear enrollment, network interfaces, table row density, and layout
- **Notification Center** - Notification history with read/unread tracking and action buttons
- **ScratchPad** - Persistent notes (local storage) accessible from the header
- **QR / Barcode Generator** - Generate QR codes and barcodes from the footer toolbar
- **API History** - Request/response debugging with timestamps and performance metrics
- **Telemetry** - Feature usage analytics viewer
- **Help Tour** - Interactive guided tour of all application features
- **Theme Selector** - 14 themes (dark, light, plain, solarized, dracula, nord, evergreen dark/light, ocean dark/light, nautical dark/light, high contrast dark/light)

---

## Mobile App

The mobile app (React Native / Expo) provides full device management on the go.

### Screens

| Screen | Description |
|--------|-------------|
| **Dashboard** | Status overview and quick navigation |
| **Devices Hub** | Device list with search and filtering |
| **Device Form** | Add/edit devices |
| **Discovery** | View discovered devices and provision them |
| **Templates** | Browse and manage config templates |
| **Templatizer** | Convert raw configs to Tera templates |
| **Groups** | Group management with membership |
| **Variables** | Per-device variable management |
| **Inspector** | Resolved variable preview |
| **Vendors** | Vendor profile management |
| **DHCP Options** | DHCP option configuration |
| **Device Models** | Hardware model browsing |
| **Actions** | Run vendor actions on devices |
| **Jobs** | Job history and status |
| **Credentials** | Credential management |
| **Topologies** | Topology browsing |
| **IPAM** | IP address management |
| **Locations** | Location hierarchy |
| **Test Containers** | Container management |
| **Scanner** | Barcode/QR code scanner for device serial numbers |
| **Settings** | App configuration and API URL |
| **Data Explorer** | State debugging |
| **Login** | Authentication |

### Mobile Setup

```bash
cd mobile
npm install
npm start
```

1. Install **Expo Go** from the App Store (iOS) or Play Store (Android)
2. Make sure your phone is on the same WiFi network as your computer
3. Scan the QR code with Expo Go (Android) or Camera app (iOS)
4. In the web UI Settings, scan the QR code next to your server's network interface to auto-configure the mobile app's API URL

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
forge-config/
├── backend-rust/              # Rust API server (Axum)
│   ├── src/
│   │   ├── main.rs            # Entry point
│   │   ├── router.rs          # Route definitions (200+ endpoints)
│   │   ├── auth.rs            # JWT authentication
│   │   ├── handlers/          # HTTP endpoint handlers
│   │   │   ├── devices.rs     # Device CRUD + connect/deploy/diff/exec
│   │   │   ├── templates.rs   # Template CRUD + preview
│   │   │   ├── vendors.rs     # Vendor, vendor action CRUD + run
│   │   │   ├── groups.rs      # Groups, members, variables
│   │   │   ├── device_variables.rs  # Per-device KV variables
│   │   │   ├── ipam.rs        # IPAM regions/campuses/datacenters/halls/rows/racks/prefixes/IPs/VRFs/tags
│   │   │   ├── topologies.rs  # Topology CRUD
│   │   │   ├── dhcp_options.rs # DHCP option management
│   │   │   ├── backups.rs     # Backup trigger & listing
│   │   │   ├── discovery.rs   # Device discovery & logs
│   │   │   ├── docker/        # Container spawn, CLOS lab, virtual CLOS
│   │   │   ├── netbox.rs      # NetBox sync endpoints
│   │   │   ├── jobs.rs        # Async job queue
│   │   │   ├── job_templates.rs # Job template CRUD + run
│   │   │   ├── credentials.rs # Credential CRUD
│   │   │   ├── device_models.rs # Device model CRUD
│   │   │   ├── device_roles.rs # Device role CRUD
│   │   │   ├── output_parsers.rs # Output parser CRUD
│   │   │   ├── port_assignments.rs # Port assignment CRUD
│   │   │   ├── users.rs       # User management
│   │   │   ├── settings.rs    # Global settings + branding + logo
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
│       ├── components/        # UI components (70+)
│       ├── context/           # React contexts
│       └── core -> ../../shared/core
│
├── mobile/                    # React Native app (Expo)
│   └── src/
│       ├── screens/           # App screens (23+)
│       ├── components/        # Mobile UI components (26+)
│       ├── navigation/        # React Navigation setup
│       ├── hooks/             # Custom hooks
│       └── core -> ../../shared/core
│
├── shared/                    # Shared code between web and mobile
│   └── core/
│       ├── types.ts           # TypeScript interfaces
│       ├── services/          # API service layer (27 modules)
│       ├── hooks/             # React hooks (42+)
│       ├── store/             # Redux store
│       ├── theme/             # Theme definitions (14 themes)
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

## Provisioning Flow

```
1. Device boots
        │
        ▼
2. DHCP Request ──────────► ForgeConfig assigns IP based on MAC
        │                    (vendor-specific DHCP options applied)
        ▼
3. TFTP/HTTP Request ─────► ForgeConfig serves device-specific config
        │                    (template rendered with device + group variables)
        ▼
4. Device applies config and comes online
        │
        ▼
5. ForgeConfig detects lease ──► Waits for backup delay
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
| GET | `/api/devices/next-hostname` | Generate next hostname from pattern |
| GET | `/api/devices/:id` | Get device by ID |
| PUT | `/api/devices/:id` | Update device |
| DELETE | `/api/devices/:id` | Delete device |
| POST | `/api/devices/:id/connect` | Test SSH connectivity |
| GET | `/api/devices/:id/config` | Get rendered config |
| POST | `/api/devices/:id/preview-config` | Preview config with variables |
| POST | `/api/devices/:id/deploy-config` | Deploy config over SSH |
| POST | `/api/devices/:id/diff-config` | Diff current vs. new config |
| POST | `/api/devices/:id/exec` | Execute command on device |

### Device Variables

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:id/variables` | List device variables |
| PUT | `/api/devices/:id/variables` | Set all device variables |
| PUT | `/api/devices/:id/variables/:key` | Set a single variable |
| DELETE | `/api/devices/:id/variables/:key` | Delete a variable |
| GET | `/api/variables/keys` | List all variable keys |
| DELETE | `/api/variables/keys/:key` | Delete a key from all devices |
| GET | `/api/variables/by-key/:key` | List all values for a key |
| POST | `/api/variables/bulk` | Bulk set variables |
| GET | `/api/devices/:id/resolved-variables` | Get resolved variables (with group inheritance) |

### Port Assignments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/:id/port-assignments` | List port assignments |
| PUT | `/api/devices/:id/port-assignments` | Bulk set port assignments |
| PUT | `/api/devices/:id/port-assignments/:port_name` | Set single port assignment |
| DELETE | `/api/devices/:id/port-assignments/:port_name` | Delete port assignment |

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
| PUT | `/api/groups/:id/members/:device_id` | Add member to group |
| DELETE | `/api/groups/:id/members/:device_id` | Remove member from group |
| GET | `/api/devices/:id/groups` | List groups for a device |
| PUT | `/api/devices/:id/groups` | Set groups for a device |

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
| POST | `/api/vendor-actions/:id/run` | Execute vendor action |

### Device Models

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device-models` | List all device models |
| POST | `/api/device-models` | Create a device model |
| GET | `/api/device-models/:id` | Get device model |
| PUT | `/api/device-models/:id` | Update device model |
| DELETE | `/api/device-models/:id` | Delete device model |

### Device Roles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device-roles` | List all device roles |
| POST | `/api/device-roles` | Create a device role |
| GET | `/api/device-roles/:id` | Get device role |
| PUT | `/api/device-roles/:id` | Update device role |
| DELETE | `/api/device-roles/:id` | Delete device role |

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
| POST | `/api/devices/:id/backup` | Trigger manual backup |
| GET | `/api/devices/:id/backups` | List backups for device |
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

### Job Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/job-templates` | List all job templates |
| POST | `/api/job-templates` | Create a job template |
| GET | `/api/job-templates/:id` | Get job template |
| PUT | `/api/job-templates/:id` | Update job template |
| DELETE | `/api/job-templates/:id` | Delete job template |
| POST | `/api/job-templates/:id/run` | Execute job template |

### Credentials

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/credentials` | List all credentials |
| POST | `/api/credentials` | Create a credential |
| GET | `/api/credentials/:id` | Get credential |
| PUT | `/api/credentials/:id` | Update credential |
| DELETE | `/api/credentials/:id` | Delete credential |

### Output Parsers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/output-parsers` | List all output parsers |
| POST | `/api/output-parsers` | Create an output parser |
| GET | `/api/output-parsers/:id` | Get output parser |
| PUT | `/api/output-parsers/:id` | Update output parser |
| DELETE | `/api/output-parsers/:id` | Delete output parser |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users |
| POST | `/api/users` | Create a user |
| GET | `/api/users/:id` | Get user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Docker / Lab Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docker/containers` | List managed containers |
| POST | `/api/docker/containers` | Spawn a test container |
| DELETE | `/api/docker/containers/:id` | Remove a container |
| POST | `/api/docker/containers/:id/start` | Start a container |
| POST | `/api/docker/containers/:id/restart` | Restart a container |
| POST | `/api/docker/clos-lab` | Build a CLOS lab topology (Docker containers) |
| DELETE | `/api/docker/clos-lab` | Tear down CLOS lab |
| POST | `/api/topology/preview` | Preview topology (CLOS or hierarchical) |
| POST | `/api/topology/build` | Build topology with device records and IPAM |
| DELETE | `/api/virtual-clos` | Tear down topology (devices, IPAM, org hierarchy) |
| POST | `/api/connect` | Test connectivity to IP |

### Tenants & GPU Clusters

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenants` | List all tenants |
| POST | `/api/tenants` | Create a tenant |
| GET | `/api/tenants/:id` | Get tenant |
| PUT | `/api/tenants/:id` | Update tenant |
| DELETE | `/api/tenants/:id` | Delete tenant |
| GET | `/api/gpu-clusters` | List all GPU clusters |
| POST | `/api/gpu-clusters` | Create a GPU cluster |
| GET | `/api/gpu-clusters/:id` | Get GPU cluster |
| PUT | `/api/gpu-clusters/:id` | Update GPU cluster |
| DELETE | `/api/gpu-clusters/:id` | Delete GPU cluster |

### IPAM

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Regions** | | |
| GET | `/api/ipam/regions` | List regions |
| POST | `/api/ipam/regions` | Create region |
| GET | `/api/ipam/regions/:id` | Get region |
| PUT | `/api/ipam/regions/:id` | Update region |
| DELETE | `/api/ipam/regions/:id` | Delete region |
| **Campuses** | | |
| GET | `/api/ipam/campuses` | List campuses |
| POST | `/api/ipam/campuses` | Create campus |
| GET | `/api/ipam/campuses/:id` | Get campus |
| PUT | `/api/ipam/campuses/:id` | Update campus |
| DELETE | `/api/ipam/campuses/:id` | Delete campus |
| **Datacenters** | | |
| GET | `/api/ipam/datacenters` | List datacenters |
| POST | `/api/ipam/datacenters` | Create datacenter |
| GET | `/api/ipam/datacenters/:id` | Get datacenter |
| PUT | `/api/ipam/datacenters/:id` | Update datacenter |
| DELETE | `/api/ipam/datacenters/:id` | Delete datacenter |
| **Halls** | | |
| GET | `/api/ipam/halls` | List halls |
| POST | `/api/ipam/halls` | Create hall |
| GET | `/api/ipam/halls/:id` | Get hall |
| PUT | `/api/ipam/halls/:id` | Update hall |
| DELETE | `/api/ipam/halls/:id` | Delete hall |
| **Rows** | | |
| GET | `/api/ipam/rows` | List rows |
| POST | `/api/ipam/rows` | Create row |
| GET | `/api/ipam/rows/:id` | Get row |
| PUT | `/api/ipam/rows/:id` | Update row |
| DELETE | `/api/ipam/rows/:id` | Delete row |
| **Racks** | | |
| GET | `/api/ipam/racks` | List racks |
| POST | `/api/ipam/racks` | Create rack |
| GET | `/api/ipam/racks/:id` | Get rack |
| PUT | `/api/ipam/racks/:id` | Update rack |
| DELETE | `/api/ipam/racks/:id` | Delete rack |
| **Roles** | | |
| GET | `/api/ipam/roles` | List roles |
| POST | `/api/ipam/roles` | Create role |
| DELETE | `/api/ipam/roles/:id` | Delete role |
| **VRFs** | | |
| GET | `/api/ipam/vrfs` | List VRFs |
| POST | `/api/ipam/vrfs` | Create VRF |
| GET | `/api/ipam/vrfs/:id` | Get VRF |
| PUT | `/api/ipam/vrfs/:id` | Update VRF |
| DELETE | `/api/ipam/vrfs/:id` | Delete VRF |
| **Prefixes** | | |
| GET | `/api/ipam/prefixes` | List prefixes |
| GET | `/api/ipam/prefixes/supernets` | List supernets |
| POST | `/api/ipam/prefixes` | Create prefix |
| GET | `/api/ipam/prefixes/:id` | Get prefix |
| PUT | `/api/ipam/prefixes/:id` | Update prefix |
| DELETE | `/api/ipam/prefixes/:id` | Delete prefix |
| POST | `/api/ipam/prefixes/:id/available-prefixes` | Get next available prefix |
| POST | `/api/ipam/prefixes/:id/available-ips` | Get next available IP |
| **IP Addresses** | | |
| GET | `/api/ipam/ip-addresses` | List IP addresses |
| POST | `/api/ipam/ip-addresses` | Create IP address |
| GET | `/api/ipam/ip-addresses/:id` | Get IP address |
| PUT | `/api/ipam/ip-addresses/:id` | Update IP address |
| DELETE | `/api/ipam/ip-addresses/:id` | Delete IP address |
| **Tags** | | |
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

### Settings & Branding

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get global settings |
| PUT | `/api/settings` | Update settings |
| POST | `/api/reload` | Reload DHCP/TFTP config |
| GET | `/api/network/addresses` | List local network interfaces |
| GET | `/api/branding` | Get branding info (public) |
| GET | `/api/branding/logo` | Get logo image (public) |
| POST | `/api/branding/logo` | Upload logo |
| DELETE | `/api/branding/logo` | Delete logo |

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
| `DB_PATH` | `/data/forge-config.db` | SQLite database path |
| `TFTP_DIR` | `/tftp` | TFTP root directory |
| `BACKUP_DIR` | `/backups` | Config backup directory |
| `TEMPLATES_DIR` | `/configs/templates` | Config templates directory |
| `RUST_LOG` | `info` | Log level |
| `JWT_SECRET` | `change-me-in-production` | Secret for JWT token signing |
| `DOCKER_NETWORK` | `forge-config_fc-net` | Docker network for spawned containers |
| `TEST_CLIENT_IMAGE` | `forge-config-test-client` | Docker image for test containers |

### Settings (via UI or API)

| Setting | Description |
|---------|-------------|
| **Application Name** | Custom name shown in the header and login page |
| **Logo** | Custom logo (PNG, JPG, GIF, WebP, or SVG under 2MB) |
| **Hostname Pattern** | Pattern for auto-generated hostnames (`$datacenter-$region-$hall-$role-#`) |
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
| **API URL** | Base URL for API requests (local setting) |
| **Rows per Page** | Default table pagination size (local setting) |

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

You can build an automated CLOS fabric lab from the Topologies page in the web UI, which spawns spine and leaf containers with pre-configured FRR routing and topology roles.

### Topology Builder

The topology builder creates full datacenter topologies with IPAM integration:
- **CLOS fabric** — configure spine count, leaf count, super-spines, pods, uplinks, external devices, and rack placement
- **Hierarchical (3-tier)** — configure core, distribution, and access switch counts with similar physical placement
- **GPU clusters** — attach GPU compute nodes striped across leaf/access racks with VRF isolation
- **Management switches** — auto-placed per-row, per-rack, or per-hall
- **Physical placement** — select datacenter, region, halls, rows, and racks
- **Hostname patterns** — all devices follow the system naming pattern (e.g., `$datacenter-$role-#`)
- **Preview before deploy** — review device hostnames, IP assignments, rack placement, and cabling before committing

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
- **services/** - API service layer (27 modules: devices, templates, vendors, groups, IPAM, jobs, credentials, output parsers, etc.)
- **hooks/** - React hooks (42+ hooks: useDevices, useSettings, useBackups, useTheme, useJobs, useIpam, etc.)
- **store/** - Redux store configuration
- **theme/** - Theme definitions (14 themes)
- **utils/** - Validation and formatting utilities

Both `frontend/src/core` and `mobile/src/core` are symlinks to `shared/core/`.

---

## Troubleshooting

### Mobile app can't connect to API

1. Ensure your phone and computer are on the same WiFi network
2. Open Settings in the web UI and scan the QR code next to your network interface
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

1. Verify template exists in the Configuration > Templates tab
2. Check that the device has the correct template assigned
3. Look for Tera rendering errors in the logs
4. Ensure required variables are set on the device or its groups (check Configuration > Inspector)

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
