# Build stage
FROM rust:1.85-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconf libssh2-dev libssh2-static zlib-dev zlib-static

WORKDIR /app

# Copy manifest files
COPY Cargo.toml Cargo.lock* ./

# Create a dummy main.rs to cache dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs

# Build dependencies (this will be cached)
RUN cargo build --release && rm -rf src

# Copy actual source code
COPY src ./src

# Touch main.rs to ensure it gets rebuilt
RUN touch src/main.rs

# Build the actual application
RUN cargo build --release

# Runtime stage
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache \
    dnsmasq \
    openssh-client \
    ca-certificates \
    tzdata \
    libssh2

WORKDIR /app

# Copy the binary from builder
COPY --from=builder /app/target/release/ztp-server /app/ztp-server

# Copy dhcp-script for vendor class capture
COPY scripts/dhcp-notify.sh /scripts/dhcp-notify.sh
RUN chmod +x /scripts/dhcp-notify.sh

# Create required directories
RUN mkdir -p /data /tftp /backups /dnsmasq /configs/templates /var/lib/misc

# Set default environment variables
ENV DB_PATH=/data/ztp.db
ENV DNSMASQ_CONFIG=/dnsmasq/dnsmasq.conf
ENV TFTP_DIR=/tftp
ENV TEMPLATES_DIR=/configs/templates
ENV BACKUP_DIR=/backups
ENV LEASE_PATH=/var/lib/misc/dnsmasq.leases
ENV DNSMASQ_PID=/var/run/dnsmasq.pid
ENV LISTEN_ADDR=0.0.0.0:8080
ENV DHCP_INTERFACE=eth0
ENV FRONTEND_DIR=/app/frontend
ENV RUST_LOG=info

# Expose ports
# 8080 - HTTP API
# 67 - DHCP
# 69 - TFTP
EXPOSE 8080 67/udp 69/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1:8080/api/settings || exit 1

# Run the server
CMD ["/app/ztp-server"]
