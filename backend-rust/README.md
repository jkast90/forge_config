# ZTP Server - Rust Backend

A Rust implementation of the Zero Touch Provisioning (ZTP) server backend.

## Overview

This is a port of the Go backend to Rust, providing the same functionality with Rust's performance and safety guarantees.

## Features

- **Device Management**: CRUD operations for network devices
- **DHCP/TFTP Integration**: Manages dnsmasq for DHCP and TFTP services
- **Config Templates**: Tera-based template engine for device configurations
- **SSH Backups**: Automated config backup via SSH
- **WebSocket Events**: Real-time notifications for device discovery and status changes
- **Vendor Management**: Support for multiple vendors (Cisco, Arista, Juniper, OpenGear, etc.)
- **NetBox Integration**: Sync devices with NetBox (placeholder implementation)

## Project Structure

```
backend-rust/
├── Cargo.toml              # Dependencies and project metadata
├── Dockerfile              # Container build configuration
├── src/
│   ├── main.rs            # Application entry point and router setup
│   ├── config/            # Configuration loading from environment
│   ├── db/                # SQLite database operations
│   ├── models/            # Data structures and types
│   ├── handlers/          # HTTP API handlers
│   │   ├── devices.rs     # Device CRUD endpoints
│   │   ├── settings.rs    # Settings management
│   │   ├── vendors.rs     # Vendor configuration
│   │   ├── templates.rs   # Config template management
│   │   ├── dhcp_options.rs# DHCP option configuration
│   │   ├── backups.rs     # Backup management
│   │   ├── discovery.rs   # Device discovery
│   │   ├── configs.rs     # Config file serving
│   │   └── netbox.rs      # NetBox integration
│   ├── dhcp/              # DHCP/dnsmasq management
│   │   ├── config.rs      # dnsmasq config generation
│   │   └── leases.rs      # Lease file monitoring
│   ├── backup/            # SSH backup service
│   ├── ws/                # WebSocket hub
│   ├── status/            # Device status checker
│   ├── netbox/            # NetBox client
│   └── utils/             # Utility functions
```

## Building

### Local Development

```bash
cd backend-rust
cargo build --release
```

### Docker

```bash
# From project root
docker-compose -f docker-compose.rust.yml up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `/data/ztp.db` | SQLite database path |
| `DNSMASQ_CONFIG` | `/dnsmasq/dnsmasq.conf` | dnsmasq config file path |
| `TFTP_DIR` | `/tftp` | TFTP root directory |
| `TEMPLATES_DIR` | `/configs/templates` | Config templates directory |
| `BACKUP_DIR` | `/backups` | Backup storage directory |
| `LEASE_PATH` | `/var/lib/misc/dnsmasq.leases` | dnsmasq lease file path |
| `DNSMASQ_PID` | `/var/run/dnsmasq.pid` | dnsmasq PID file |
| `LISTEN_ADDR` | `0.0.0.0:8080` | HTTP server listen address |
| `DHCP_INTERFACE` | `eth0` | Network interface for DHCP |
| `FRONTEND_DIR` | `/app/frontend` | Frontend static files directory |
| `RUST_LOG` | `info` | Log level (trace, debug, info, warn, error) |

## API Endpoints

The API is compatible with the Go backend. See the main project README for full API documentation.

### Key Endpoints

- `GET /api/devices` - List all devices
- `POST /api/devices` - Create a device
- `GET /api/devices/:mac` - Get device by MAC
- `PUT /api/devices/:mac` - Update device
- `DELETE /api/devices/:mac` - Delete device
- `POST /api/devices/:mac/connect` - Test connectivity
- `POST /api/devices/:mac/backup` - Trigger backup
- `GET /api/settings` - Get settings
- `PUT /api/settings` - Update settings
- `GET /api/vendors` - List vendors
- `GET /api/templates` - List templates
- `GET /api/dhcp-options` - List DHCP options
- `GET /api/discovery` - List undiscovered devices
- `GET /api/ws` - WebSocket connection

## Dependencies

Key dependencies:
- **axum**: Web framework
- **tokio**: Async runtime
- **sqlx**: Database access (SQLite)
- **serde**: Serialization
- **tera**: Template engine
- **tower-http**: HTTP middleware (CORS, static files)

## Differences from Go Backend

1. **Template Syntax**: Uses Tera syntax (similar to Jinja2) instead of Go's text/template. Templates are automatically converted from Go syntax.

2. **SSH Implementation**: Currently uses TCP connectivity check as a placeholder. Full SSH with russh is stubbed but not fully implemented.

3. **Async/Await**: Uses Tokio for all async operations, providing excellent concurrent performance.

4. **Error Handling**: Uses Rust's Result type throughout with anyhow for error context.

## License

Same as the main ZTP Server project.
