# Bazel vs Current Build Commands

## Side-by-Side

| What | Current | Bazel |
|------|---------|-------|
| Build backend | `docker compose build backend-rust` | `bazel build //backend-rust:ztp-server` |
| Build frontend | `cd frontend && npx vite build` | `bazel build //frontend:bundle` |
| Type-check frontend | `cd frontend && npx tsc --noEmit` | `bazel test //frontend:typecheck` |
| Type-check mobile | `cd mobile && npx tsc --noEmit` | `bazel test //mobile:typecheck` |
| Build everything | `docker compose build` | `bazel build //...` |
| Test everything | (manual) | `bazel test //...` |
| Build Docker image | `docker compose build backend-rust` | `bazel build //backend-rust:image_tarball` |
| Load image into Docker | (automatic) | `docker load < bazel-bin/backend-rust/image_tarball/tarball.tar` |

## Key Differences

### What Changes
- **One tool** instead of cargo + npm + docker + vite
- **Incremental** — change one .rs file, only that crate recompiles
- **Cacheable** — CI and teammates share build artifacts via remote cache
- **Hermetic** — Bazel downloads its own Rust 1.85 and Node 20, no "works on my machine"
- **Parallel** — independent targets build concurrently automatically

### What Stays the Same
- Source code doesn't change at all
- Cargo.toml / package.json still define your dependencies
- Docker Compose still works for local dev (Bazel is additive, not replacing)
- Git workflow unchanged

### What Gets Harder
- Adding a dependency: edit Cargo.toml, then run `CARGO_BAZEL_REPIN=1 bazel sync --only=crates`
- Frontend tooling: Vite's dev server, HMR, etc. don't fit Bazel's model well
- Debugging: build failures show Bazel sandbox paths, not your source tree
- Mobile: Expo/EAS builds are largely opaque to Bazel

## Common Commands

```bash
# Build a specific target
bazel build //backend-rust:ztp-server

# Build everything in a directory
bazel build //backend-rust/...

# Build everything in the whole repo
bazel build //...

# Run tests
bazel test //backend-rust:ztp-server-test

# Run a binary
bazel run //backend-rust:ztp-server

# See what a target depends on
bazel query 'deps(//backend-rust:ztp-server)' --output=graph

# See what targets exist in a package
bazel query '//frontend/...'

# See what changed between two commits (advanced)
# Useful for CI: only test affected targets
bazel query 'rdeps(//..., set(path/to/changed/file.rs))'

# Clean everything
bazel clean

# Clean + expunge (nuclear option)
bazel clean --expunge

# Re-pin Rust dependencies after Cargo.toml change
CARGO_BAZEL_REPIN=1 bazel sync --only=crates

# Re-pin npm dependencies after package.json change
# (requires regenerating pnpm-lock.yaml first)
pnpm install --lockfile-only
bazel sync --only=npm_frontend
```

## BUILD File Anatomy

```python
# A BUILD file declares targets in its directory

load("@rules_rust//rust:defs.bzl", "rust_binary")  # Import the rule

rust_binary(
    name = "my-server",          # Target name: //my-pkg:my-server
    srcs = glob(["src/**/*.rs"]),  # Source files (glob = wildcard)
    deps = ["@crates//:axum"],    # Dependencies (other targets)
    visibility = ["//visibility:public"],  # Who can depend on this
)
```

## Mental Model

Think of Bazel as a **DAG (directed acyclic graph)** of build steps:

```
//shared/core:core
       |
       ├──────────────────┐
       v                  v
//frontend:app       //mobile:typecheck
       |
       v
//frontend:bundle
       |
       v
//backend-rust:image  (includes frontend dist)
```

Change `shared/core/types.ts` → Bazel knows to rebuild `core`, `frontend:app`,
`frontend:bundle`, and `backend-rust:image`, but NOT `backend-rust:ztp-server`
(because the Rust binary doesn't depend on TypeScript).
