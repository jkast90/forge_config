FROM alpine:3.19

ARG GOBGP_VERSION=3.28.0
ARG TARGETARCH=amd64

# Install required packages
RUN apk add --no-cache \
    dhclient \
    tftp-hpa \
    dropbear \
    dropbear-scp \
    bash \
    curl \
    iproute2 \
    iputils-ping \
    procps

# Download and install GoBGP
RUN curl -sL "https://github.com/osrg/gobgp/releases/download/v${GOBGP_VERSION}/gobgp_${GOBGP_VERSION}_linux_${TARGETARCH}.tar.gz" \
    | tar -xz -C /usr/local/bin/ gobgp gobgpd && \
    chmod +x /usr/local/bin/gobgp /usr/local/bin/gobgpd

# Create directories
RUN mkdir -p /etc/dropbear /root/.ssh /config /etc/gobgp

# Generate SSH host keys
RUN dropbearkey -t rsa -f /etc/dropbear/dropbear_rsa_host_key && \
    dropbearkey -t ecdsa -f /etc/dropbear/dropbear_ecdsa_host_key

# Create admin user with password 'admin'
RUN adduser -D -s /bin/bash admin && \
    echo "admin:admin" | chpasswd

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

EXPOSE 22 179 50051

ENTRYPOINT ["/entrypoint.sh"]
