#!/usr/bin/env bash
# workspace_status.sh — provides build metadata to Bazel's --stamp feature.
#
# Bazel calls this script during stamped builds (--config=ci, --config=release)
# and injects the key-value pairs into binaries and container image labels.
#
# Keys prefixed with STABLE_ are included in the build action cache key,
# meaning a change in their value triggers a rebuild. Use this for version info
# that should invalidate the binary (git commit, branch).
#
# Keys WITHOUT the STABLE_ prefix are "volatile" — they change every build
# (like timestamps) but do NOT invalidate the cache.

set -euo pipefail

# ---- Stable keys (invalidate cache on change) ----

# Current git commit SHA
echo "STABLE_GIT_SHA $(git rev-parse HEAD 2>/dev/null || echo unknown)"

# Current branch
echo "STABLE_GIT_BRANCH $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

# Whether the working tree is clean
if git diff --quiet HEAD 2>/dev/null; then
    echo "STABLE_GIT_DIRTY false"
else
    echo "STABLE_GIT_DIRTY true"
fi

# Most recent tag (for semver)
echo "STABLE_GIT_TAG $(git describe --tags --abbrev=0 2>/dev/null || echo v0.0.0)"

# ---- Volatile keys (don't invalidate cache) ----

echo "BUILD_TIMESTAMP $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "BUILD_USER ${USER:-unknown}"
echo "BUILD_HOST $(hostname -s 2>/dev/null || echo unknown)"
