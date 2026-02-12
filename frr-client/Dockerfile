FROM debian:bookworm-slim

# Install FRR and networking tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    frr \
    frr-pythontools \
    isc-dhcp-client \
    tftp-hpa \
    dropbear \
    dropbear-bin \
    curl \
    iproute2 \
    iputils-ping \
    procps \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /etc/dropbear /root/.ssh /config /var/run/frr /var/log/frr

# Generate SSH host keys
RUN dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key && \
    dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key

# Create admin user with password 'admin'
RUN useradd -m -s /bin/bash admin && \
    echo "admin:admin" | chpasswd

# Copy FRR daemons config
COPY daemons /etc/frr/daemons

# Copy scripts
COPY entrypoint.sh /entrypoint.sh
COPY show_config.sh /usr/local/bin/show
RUN chmod +x /entrypoint.sh /usr/local/bin/show

# Make 'show running-config' work via SSH
RUN ln -s /usr/local/bin/show /usr/local/bin/show-running-config && \
    mkdir -p /usr/local/bin && \
    echo '#!/bin/bash' > /usr/local/bin/running-config && \
    echo 'exec /usr/local/bin/show running-config' >> /usr/local/bin/running-config && \
    chmod +x /usr/local/bin/running-config

# Ensure FRR directories have correct ownership
RUN chown -R frr:frr /etc/frr /var/run/frr /var/log/frr

EXPOSE 22 179

ENTRYPOINT ["/entrypoint.sh"]
