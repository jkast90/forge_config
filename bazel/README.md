# Bazel Build Configuration

This directory contains a reference Bazel configuration for the ZTP app monorepo.

## Structure

```
MODULE.bazel          - Root module definition (replaces WORKSPACE)
.bazelrc              - Build flags and settings
BUILD.bazel           - Root BUILD file
backend-rust/BUILD.bazel
frontend/BUILD.bazel
shared/core/BUILD.bazel
```

## Quick Start

```bash
# Build everything
bazel build //...

# Build just the backend
bazel build //backend-rust:ztp-server

# Build the frontend bundle
bazel build //frontend:bundle

# Build the Docker image
bazel build //backend-rust:image

# Run tests
bazel test //...

# Query the dependency graph
bazel query 'deps(//backend-rust:ztp-server)'
```

## Notes

- This is a starting point / reference config, not production-ready
- Rust builds use rules_rust with crate_universe for Cargo.toml integration
- Frontend uses rules_js + rules_ts for hermetic Node.js/TypeScript
- Docker images use rules_oci (replaces rules_docker)
- The shared/core module is a ts_project depended on by both frontend and mobile
