FROM alpine:3.19

# Install FRR and SSH
RUN apk add --no-cache \
    frr frr-openrc \
    openssh-server \
    bash iproute2 curl \
    tcpdump iputils

# Enable all FRR daemons we need
RUN sed -i 's/^bgpd=no/bgpd=yes/' /etc/frr/daemons && \
    sed -i 's/^zebra=no/zebra=yes/' /etc/frr/daemons && \
    sed -i 's/^staticd=no/staticd=yes/' /etc/frr/daemons

# Setup SSH
RUN ssh-keygen -A && \
    mkdir -p /run/sshd && \
    sed -i 's/#PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    echo "PermitEmptyPasswords no" >> /etc/ssh/sshd_config

# Create admin user with password 'admin'
RUN adduser -D -s /bin/bash admin && \
    echo "admin:admin" | chpasswd && \
    adduser admin frrvty && \
    adduser admin frr

# Let admin use vtysh without sudo
RUN echo "admin ALL=(ALL) NOPASSWD: /usr/bin/vtysh" >> /etc/sudoers && \
    echo "service integrated-vtysh-config" > /etc/frr/vtysh.conf && \
    chown frr:frrvty /etc/frr/vtysh.conf

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 22 179

ENTRYPOINT ["/entrypoint.sh"]
