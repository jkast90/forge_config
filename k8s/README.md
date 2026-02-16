# ForgeConfig — Kubernetes Deployment

## Quick Start

```bash
# Preview what will be applied
kubectl kustomize k8s/base

# Apply everything
kubectl apply -k k8s/base
```

## Before You Deploy

### 1. Set a real JWT secret

Edit `base/secret.yaml` (or better yet, use a sealed-secret / external-secrets operator):

```bash
JWT_SECRET=$(openssl rand -base64 32)
```

### 2. Push your container images

The manifests reference placeholder image names:

| Manifest | Image |
|----------|-------|
| `backend-deployment.yaml` | `forgeconfig/backend:latest` |
| `frontend-deployment.yaml` | `forgeconfig/frontend:latest` |

Build and push to your registry, then update the image references (or use a Kustomize overlay).

### 3. Set the Ingress hostname

Replace `forgeconfig.example.com` in `base/ingress.yaml` with your actual domain.

## Architecture Notes

### SQLite single-writer constraint

The backend uses SQLite, which only supports a single writer. The backend Deployment is
set to `replicas: 1` with `strategy: Recreate` to avoid two pods competing for the
database file. If you need horizontal scaling, migrate to PostgreSQL first.

### DHCP/TFTP and the network

Zero-touch provisioning requires the backend's DHCP (UDP/67) and TFTP (UDP/69) ports to
be reachable from the physical network where devices boot. The base config includes a
`NodePort` service (`backend-network`) that maps these to ports 30067 and 30069.

Depending on your environment, you may prefer one of these alternatives:

| Approach | When to use |
|----------|-------------|
| **NodePort** (default) | Simple clusters; forward ports at the edge |
| **hostNetwork: true** | Backend pod binds directly to the node's NIC — best for bare-metal |
| **MetalLB / LoadBalancer** | Bare-metal clusters with L2/BGP address pools |
| **Multus + macvlan** | Attach the pod to a dedicated provisioning VLAN |

To switch to `hostNetwork`, add this to the backend pod spec:

```yaml
spec:
  hostNetwork: true
  dnsPolicy: ClusterFirstWithHostNet
```

### Persistent storage

Three PVCs are created for the backend:

| PVC | Mount | Purpose |
|-----|-------|---------|
| `backend-data` (1Gi) | `/data` | SQLite database |
| `backend-tftp` (5Gi) | `/tftp` | TFTP-served config files |
| `backend-backups` (10Gi) | `/backups` | Device config backups |

Adjust sizes and `storageClassName` to match your cluster.

### Config templates

Device config templates can be supplied via an optional ConfigMap named
`backend-templates`. If it does not exist the volume mount is skipped
(`optional: true`). To create it from your local templates directory:

```bash
kubectl create configmap backend-templates \
  --from-file=configs/templates/ \
  -n forgeconfig
```

## File Listing

```
k8s/
  base/
    kustomization.yaml        # Ties everything together
    namespace.yaml             # forgeconfig namespace
    configmap.yaml             # Non-secret backend env vars
    secret.yaml                # JWT_SECRET (replace before deploying!)
    pvc.yaml                   # Persistent volumes for data, tftp, backups
    backend-deployment.yaml    # Rust backend (single replica, NET_ADMIN)
    backend-service.yaml       # ClusterIP + NodePort for DHCP/TFTP
    frontend-deployment.yaml   # React frontend (scalable)
    frontend-service.yaml      # ClusterIP
    ingress.yaml               # Nginx ingress with /api -> backend routing
```
