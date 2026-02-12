#!/bin/bash
# Build all backend images and run API tests against them
# Results are saved to test-results.txt

set -e

RESULTS_FILE="test-results.txt"
NETWORK="ztp-test-net"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ports for each backend
GO_PORT=9080
RUST_PORT=9081
PYTHON_PORT=9082

# Container names
GO_CONTAINER="ztp-test-go"
RUST_CONTAINER="ztp-test-rust"
PYTHON_CONTAINER="ztp-test-python"

log() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')] ERROR:${NC} $1"
}

success() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

cleanup() {
    log "Cleaning up containers..."
    docker stop $GO_CONTAINER $RUST_CONTAINER $PYTHON_CONTAINER 2>/dev/null || true
    docker rm $GO_CONTAINER $RUST_CONTAINER $PYTHON_CONTAINER 2>/dev/null || true
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Start fresh
echo "========================================" | tee "$RESULTS_FILE"
echo "ZTP Server Build & Test Results" | tee -a "$RESULTS_FILE"
echo "Date: $(date)" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Clean up any existing test containers
cleanup 2>/dev/null

# Create network if it doesn't exist
docker network create $NETWORK 2>/dev/null || true

# ============================================
# Build Go Backend
# ============================================
log "Building Go backend..."
echo "=== Go Backend ===" | tee -a "$RESULTS_FILE"
BUILD_START=$(date +%s)

if docker build -t ztp-server-go -f Dockerfile . 2>&1 | tee -a "$RESULTS_FILE.build.go"; then
    BUILD_END=$(date +%s)
    GO_BUILD_TIME=$((BUILD_END - BUILD_START))
    success "Go backend built in ${GO_BUILD_TIME}s"
    echo "Build time: ${GO_BUILD_TIME}s" | tee -a "$RESULTS_FILE"

    # Get image size
    GO_IMAGE_SIZE=$(docker images ztp-server-go --format "{{.Size}}")
    echo "Image size: $GO_IMAGE_SIZE" | tee -a "$RESULTS_FILE"
else
    error "Go backend build failed"
    echo "Build: FAILED" | tee -a "$RESULTS_FILE"
    GO_BUILD_TIME="FAILED"
fi
echo "" | tee -a "$RESULTS_FILE"

# ============================================
# Build Rust Backend
# ============================================
log "Building Rust backend..."
echo "=== Rust Backend ===" | tee -a "$RESULTS_FILE"
BUILD_START=$(date +%s)

if docker build -t ztp-server-rust -f backend-rust/Dockerfile backend-rust 2>&1 | tee -a "$RESULTS_FILE.build.rust"; then
    BUILD_END=$(date +%s)
    RUST_BUILD_TIME=$((BUILD_END - BUILD_START))
    success "Rust backend built in ${RUST_BUILD_TIME}s"
    echo "Build time: ${RUST_BUILD_TIME}s" | tee -a "$RESULTS_FILE"

    # Get image size
    RUST_IMAGE_SIZE=$(docker images ztp-server-rust --format "{{.Size}}")
    echo "Image size: $RUST_IMAGE_SIZE" | tee -a "$RESULTS_FILE"
else
    error "Rust backend build failed"
    echo "Build: FAILED" | tee -a "$RESULTS_FILE"
    RUST_BUILD_TIME="FAILED"
fi
echo "" | tee -a "$RESULTS_FILE"

# ============================================
# Build Python Backend
# ============================================
log "Building Python backend..."
echo "=== Python Backend ===" | tee -a "$RESULTS_FILE"
BUILD_START=$(date +%s)

if docker build -t ztp-server-python -f backend-python/Dockerfile backend-python 2>&1 | tee -a "$RESULTS_FILE.build.python"; then
    BUILD_END=$(date +%s)
    PYTHON_BUILD_TIME=$((BUILD_END - BUILD_START))
    success "Python backend built in ${PYTHON_BUILD_TIME}s"
    echo "Build time: ${PYTHON_BUILD_TIME}s" | tee -a "$RESULTS_FILE"

    # Get image size
    PYTHON_IMAGE_SIZE=$(docker images ztp-server-python --format "{{.Size}}")
    echo "Image size: $PYTHON_IMAGE_SIZE" | tee -a "$RESULTS_FILE"
else
    error "Python backend build failed"
    echo "Build: FAILED" | tee -a "$RESULTS_FILE"
    PYTHON_BUILD_TIME="FAILED"
fi
echo "" | tee -a "$RESULTS_FILE"

# ============================================
# Start Containers
# ============================================
log "Starting test containers..."

docker run -d --name $GO_CONTAINER -p $GO_PORT:8080 --network $NETWORK ztp-server-go
docker run -d --name $RUST_CONTAINER -p $RUST_PORT:8080 --network $NETWORK ztp-server-rust
docker run -d --name $PYTHON_CONTAINER -p $PYTHON_PORT:8080 --network $NETWORK ztp-server-python

# Wait for containers to be ready
log "Waiting for containers to start..."
sleep 5

# Check if containers are running
for container in $GO_CONTAINER $RUST_CONTAINER $PYTHON_CONTAINER; do
    if ! docker ps | grep -q $container; then
        error "Container $container failed to start"
        docker logs $container 2>&1 | tail -20
    fi
done

# ============================================
# Run Tests
# ============================================
echo "" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "API Test Results" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

run_tests() {
    local name=$1
    local url=$2
    local output_file="$RESULTS_FILE.tests.$name"

    log "Testing $name backend at $url..."
    echo "=== $name Backend Tests ===" | tee -a "$RESULTS_FILE"

    if ./test-api.sh "$url" > "$output_file" 2>&1; then
        # Extract results from output
        local results=$(grep -E "^Test Results:" "$output_file" | head -1)
        local passed=$(grep -oE "[0-9]+ passed" "$output_file" | tail -1)
        local failed=$(grep -oE "[0-9]+ failed" "$output_file" | tail -1)

        echo "Results: $passed, $failed" | tee -a "$RESULTS_FILE"

        # Check for any failures
        if echo "$failed" | grep -qE "^0 failed"; then
            success "$name: All tests passed!"
        else
            error "$name: Some tests failed"
            # Show failed tests
            grep "FAIL" "$output_file" | tee -a "$RESULTS_FILE"
        fi
    else
        error "$name backend tests failed to run"
        echo "Tests: FAILED TO RUN" | tee -a "$RESULTS_FILE"
        cat "$output_file" | tail -20 | tee -a "$RESULTS_FILE"
    fi
    echo "" | tee -a "$RESULTS_FILE"
}

run_tests "Go" "http://localhost:$GO_PORT"
run_tests "Rust" "http://localhost:$RUST_PORT"
run_tests "Python" "http://localhost:$PYTHON_PORT"

# ============================================
# Performance Benchmark (Requests per Second)
# ============================================
echo "========================================" | tee -a "$RESULTS_FILE"
echo "Performance Benchmark (RPS)" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Benchmark function - measures requests per second
benchmark_rps() {
    local name=$1
    local url=$2
    local endpoint=$3
    local requests=${4:-1000}
    local concurrency=${5:-20}

    # Use curl in a loop with time measurement
    local start_time=$(date +%s.%N)

    # Run concurrent requests
    for i in $(seq 1 $requests); do
        curl -s "$url$endpoint" > /dev/null &
        # Limit concurrency
        if (( i % concurrency == 0 )); then
            wait
        fi
    done
    wait

    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc)
    local rps=$(echo "scale=2; $requests / $duration" | bc)

    echo "$rps"
}

echo "=== With DB (GET /api/settings) ===" | tee -a "$RESULTS_FILE"
log "Benchmarking Go..."
Go_RPS_DB=$(benchmark_rps "Go" "http://localhost:$GO_PORT" "/api/settings")
echo "Go: $Go_RPS_DB req/s" | tee -a "$RESULTS_FILE"
log "Benchmarking Rust..."
Rust_RPS_DB=$(benchmark_rps "Rust" "http://localhost:$RUST_PORT" "/api/settings")
echo "Rust: $Rust_RPS_DB req/s" | tee -a "$RESULTS_FILE"
log "Benchmarking Python..."
Python_RPS_DB=$(benchmark_rps "Python" "http://localhost:$PYTHON_PORT" "/api/settings")
echo "Python: $Python_RPS_DB req/s" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== Static Response (GET /api/benchmark) ===" | tee -a "$RESULTS_FILE"
log "Benchmarking Go..."
Go_RPS=$(benchmark_rps "Go" "http://localhost:$GO_PORT" "/api/benchmark")
echo "Go: $Go_RPS req/s" | tee -a "$RESULTS_FILE"
log "Benchmarking Rust..."
Rust_RPS=$(benchmark_rps "Rust" "http://localhost:$RUST_PORT" "/api/benchmark")
echo "Rust: $Rust_RPS req/s" | tee -a "$RESULTS_FILE"
log "Benchmarking Python..."
Python_RPS=$(benchmark_rps "Python" "http://localhost:$PYTHON_PORT" "/api/benchmark")
echo "Python: $Python_RPS req/s" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== JSON Serialization (GET /api/json-bench) ===" | tee -a "$RESULTS_FILE"
log "Testing JSON serialization (1000 nested objects)..."

# Get single request timing from each backend (elapsed_ms from JSON response)
Go_JSON_MS=$(curl -s "http://localhost:$GO_PORT/api/json-bench" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_JSON_MS=$(curl -s "http://localhost:$RUST_PORT/api/json-bench" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_JSON_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/json-bench" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

# Format to 2 decimal places for display
Go_JSON_FMT=$(printf "%.2f" "$Go_JSON_MS" 2>/dev/null || echo "$Go_JSON_MS")
Rust_JSON_FMT=$(printf "%.2f" "$Rust_JSON_MS" 2>/dev/null || echo "$Rust_JSON_MS")
Python_JSON_FMT=$(printf "%.2f" "$Python_JSON_MS" 2>/dev/null || echo "$Python_JSON_MS")

echo "Go: ${Go_JSON_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_JSON_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_JSON_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== CPU Intensive (GET /api/mandelbrot) ===" | tee -a "$RESULTS_FILE"
log "Testing Mandelbrot (800x800, 1000 iterations)..."

# Get single request timing from each backend (elapsed_ms from JSON response)
Go_CPU_MS=$(curl -s "http://localhost:$GO_PORT/api/mandelbrot" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_CPU_MS=$(curl -s "http://localhost:$RUST_PORT/api/mandelbrot" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_CPU_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/mandelbrot" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

# Format to 2 decimal places for display
Go_CPU_FMT=$(printf "%.2f" "$Go_CPU_MS" 2>/dev/null || echo "$Go_CPU_MS")
Rust_CPU_FMT=$(printf "%.2f" "$Rust_CPU_MS" 2>/dev/null || echo "$Rust_CPU_MS")
Python_CPU_FMT=$(printf "%.2f" "$Python_CPU_MS" 2>/dev/null || echo "$Python_CPU_MS")

echo "Go: ${Go_CPU_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_CPU_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_CPU_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== Template: Simple (GET /api/template-simple) ===" | tee -a "$RESULTS_FILE"
log "Testing Simple Template (basic variable substitution)..."

Go_TPL_SIMPLE_MS=$(curl -s "http://localhost:$GO_PORT/api/template-simple" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_TPL_SIMPLE_MS=$(curl -s "http://localhost:$RUST_PORT/api/template-simple" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_TPL_SIMPLE_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/template-simple" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

Go_TPL_SIMPLE_FMT=$(printf "%.3f" "$Go_TPL_SIMPLE_MS" 2>/dev/null || echo "$Go_TPL_SIMPLE_MS")
Rust_TPL_SIMPLE_FMT=$(printf "%.3f" "$Rust_TPL_SIMPLE_MS" 2>/dev/null || echo "$Rust_TPL_SIMPLE_MS")
Python_TPL_SIMPLE_FMT=$(printf "%.3f" "$Python_TPL_SIMPLE_MS" 2>/dev/null || echo "$Python_TPL_SIMPLE_MS")

echo "Go: ${Go_TPL_SIMPLE_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_TPL_SIMPLE_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_TPL_SIMPLE_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== Template: Large (GET /api/template-large) ===" | tee -a "$RESULTS_FILE"
log "Testing Large Template (48 interfaces, 20 VLANs)..."

Go_TPL_LARGE_MS=$(curl -s "http://localhost:$GO_PORT/api/template-large" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_TPL_LARGE_MS=$(curl -s "http://localhost:$RUST_PORT/api/template-large" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_TPL_LARGE_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/template-large" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

Go_TPL_LARGE_FMT=$(printf "%.2f" "$Go_TPL_LARGE_MS" 2>/dev/null || echo "$Go_TPL_LARGE_MS")
Rust_TPL_LARGE_FMT=$(printf "%.2f" "$Rust_TPL_LARGE_MS" 2>/dev/null || echo "$Rust_TPL_LARGE_MS")
Python_TPL_LARGE_FMT=$(printf "%.2f" "$Python_TPL_LARGE_MS" 2>/dev/null || echo "$Python_TPL_LARGE_MS")

echo "Go: ${Go_TPL_LARGE_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_TPL_LARGE_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_TPL_LARGE_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== Template: ACL (GET /api/template-acl) ===" | tee -a "$RESULTS_FILE"
log "Testing ACL Template (1000 terms, many loop iterations)..."

Go_TPL_ACL_MS=$(curl -s "http://localhost:$GO_PORT/api/template-acl" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_TPL_ACL_MS=$(curl -s "http://localhost:$RUST_PORT/api/template-acl" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_TPL_ACL_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/template-acl" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

Go_TPL_ACL_FMT=$(printf "%.2f" "$Go_TPL_ACL_MS" 2>/dev/null || echo "$Go_TPL_ACL_MS")
Rust_TPL_ACL_FMT=$(printf "%.2f" "$Rust_TPL_ACL_MS" 2>/dev/null || echo "$Rust_TPL_ACL_MS")
Python_TPL_ACL_FMT=$(printf "%.2f" "$Python_TPL_ACL_MS" 2>/dev/null || echo "$Python_TPL_ACL_MS")

echo "Go: ${Go_TPL_ACL_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_TPL_ACL_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_TPL_ACL_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"
echo "=== Template: ACL 10K (GET /api/template-acl10k) ===" | tee -a "$RESULTS_FILE"
log "Testing ACL Template (10000 terms, stress test)..."

Go_TPL_ACL10K_MS=$(curl -s "http://localhost:$GO_PORT/api/template-acl10k" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Rust_TPL_ACL10K_MS=$(curl -s "http://localhost:$RUST_PORT/api/template-acl10k" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)
Python_TPL_ACL10K_MS=$(curl -s "http://localhost:$PYTHON_PORT/api/template-acl10k" | grep -o '"elapsed_ms":[0-9.]*' | cut -d':' -f2)

Go_TPL_ACL10K_FMT=$(printf "%.2f" "$Go_TPL_ACL10K_MS" 2>/dev/null || echo "$Go_TPL_ACL10K_MS")
Rust_TPL_ACL10K_FMT=$(printf "%.2f" "$Rust_TPL_ACL10K_MS" 2>/dev/null || echo "$Rust_TPL_ACL10K_MS")
Python_TPL_ACL10K_FMT=$(printf "%.2f" "$Python_TPL_ACL10K_MS" 2>/dev/null || echo "$Python_TPL_ACL10K_MS")

echo "Go: ${Go_TPL_ACL10K_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Rust: ${Rust_TPL_ACL10K_FMT}ms" | tee -a "$RESULTS_FILE"
echo "Python: ${Python_TPL_ACL10K_FMT}ms" | tee -a "$RESULTS_FILE"

echo "" | tee -a "$RESULTS_FILE"

# ============================================
# Memory Usage
# ============================================
echo "========================================" | tee -a "$RESULTS_FILE"
echo "Container Resource Usage" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"

docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}" \
    $GO_CONTAINER $RUST_CONTAINER $PYTHON_CONTAINER 2>/dev/null | tee -a "$RESULTS_FILE"

# Capture memory values for summary
GO_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" $GO_CONTAINER 2>/dev/null | cut -d'/' -f1 | xargs)
RUST_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" $RUST_CONTAINER 2>/dev/null | cut -d'/' -f1 | xargs)
PYTHON_MEM=$(docker stats --no-stream --format "{{.MemUsage}}" $PYTHON_CONTAINER 2>/dev/null | cut -d'/' -f1 | xargs)

echo "" | tee -a "$RESULTS_FILE"

# ============================================
# Summary
# ============================================
echo "========================================" | tee -a "$RESULTS_FILE"
echo "Summary" | tee -a "$RESULTS_FILE"
echo "========================================" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Extract test results
GO_TESTS=$(grep -oE "[0-9]+ passed" "$RESULTS_FILE.tests.Go" 2>/dev/null | tail -1 || echo "N/A")
RUST_TESTS=$(grep -oE "[0-9]+ passed" "$RESULTS_FILE.tests.Rust" 2>/dev/null | tail -1 || echo "N/A")
PYTHON_TESTS=$(grep -oE "[0-9]+ passed" "$RESULTS_FILE.tests.Python" 2>/dev/null | tail -1 || echo "N/A")

# Build & Resources Table
echo "--- Build & Resources ---" | tee -a "$RESULTS_FILE"
printf "%-10s %-12s %-12s %-12s %-12s\n" "Backend" "Build" "Image" "Memory" "Tests" | tee -a "$RESULTS_FILE"
printf "%-10s %-12s %-12s %-12s %-12s\n" "-------" "-----" "-----" "------" "-----" | tee -a "$RESULTS_FILE"
printf "%-10s %-12s %-12s %-12s %-12s\n" "Go" "${GO_BUILD_TIME}s" "$GO_IMAGE_SIZE" "$GO_MEM" "$GO_TESTS" | tee -a "$RESULTS_FILE"
printf "%-10s %-12s %-12s %-12s %-12s\n" "Rust" "${RUST_BUILD_TIME}s" "$RUST_IMAGE_SIZE" "$RUST_MEM" "$RUST_TESTS" | tee -a "$RESULTS_FILE"
printf "%-10s %-12s %-12s %-12s %-12s\n" "Python" "${PYTHON_BUILD_TIME}s" "$PYTHON_IMAGE_SIZE" "$PYTHON_MEM" "$PYTHON_TESTS" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Throughput Table (RPS - higher is better)
echo "--- Throughput (req/s, higher is better) ---" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-15s\n" "Backend" "API + DB" "Static Response" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-15s\n" "-------" "--------" "---------------" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-15s\n" "Go" "$Go_RPS_DB" "$Go_RPS" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-15s\n" "Rust" "$Rust_RPS_DB" "$Rust_RPS" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-15s\n" "Python" "$Python_RPS_DB" "$Python_RPS" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Latency Table (ms - lower is better)
echo "--- Single Request Latency (ms, lower is better) ---" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-12s %-12s %-12s %-12s %-15s\n" "Backend" "JSON (1000)" "TPL Simple" "TPL Large" "ACL 1K" "ACL 10K" "Mandelbrot" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-12s %-12s %-12s %-12s %-15s\n" "-------" "-----------" "----------" "---------" "------" "-------" "----------" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-12s %-12s %-12s %-12s %-15s\n" "Go" "${Go_JSON_FMT}ms" "${Go_TPL_SIMPLE_FMT}ms" "${Go_TPL_LARGE_FMT}ms" "${Go_TPL_ACL_FMT}ms" "${Go_TPL_ACL10K_FMT}ms" "${Go_CPU_FMT}ms" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-12s %-12s %-12s %-12s %-15s\n" "Rust" "${Rust_JSON_FMT}ms" "${Rust_TPL_SIMPLE_FMT}ms" "${Rust_TPL_LARGE_FMT}ms" "${Rust_TPL_ACL_FMT}ms" "${Rust_TPL_ACL10K_FMT}ms" "${Rust_CPU_FMT}ms" | tee -a "$RESULTS_FILE"
printf "%-10s %-15s %-12s %-12s %-12s %-12s %-15s\n" "Python" "${Python_JSON_FMT}ms" "${Python_TPL_SIMPLE_FMT}ms" "${Python_TPL_LARGE_FMT}ms" "${Python_TPL_ACL_FMT}ms" "${Python_TPL_ACL10K_FMT}ms" "${Python_CPU_FMT}ms" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Performance comparison - find winner for each category
echo "--- Performance Comparison ---" | tee -a "$RESULTS_FILE"

# JSON comparison (lower ms is better)
if [ -n "$Rust_JSON_MS" ] && [ -n "$Go_JSON_MS" ] && [ -n "$Python_JSON_MS" ]; then
    JSON_MIN=$(echo "$Go_JSON_MS $Rust_JSON_MS $Python_JSON_MS" | tr ' ' '\n' | sort -n | head -1)
    JSON_GO_RATIO=$(echo "scale=1; $Go_JSON_MS / $JSON_MIN" | bc 2>/dev/null)
    JSON_RUST_RATIO=$(echo "scale=1; $Rust_JSON_MS / $JSON_MIN" | bc 2>/dev/null)
    JSON_PY_RATIO=$(echo "scale=1; $Python_JSON_MS / $JSON_MIN" | bc 2>/dev/null)
    echo "JSON Serialization: Go=${JSON_GO_RATIO}x, Rust=${JSON_RUST_RATIO}x, Python=${JSON_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

# Template Simple comparison (lower ms is better)
if [ -n "$Rust_TPL_SIMPLE_MS" ] && [ -n "$Go_TPL_SIMPLE_MS" ] && [ -n "$Python_TPL_SIMPLE_MS" ]; then
    TPL_MIN=$(echo "$Go_TPL_SIMPLE_MS $Rust_TPL_SIMPLE_MS $Python_TPL_SIMPLE_MS" | tr ' ' '\n' | sort -n | head -1)
    TPL_GO_RATIO=$(echo "scale=1; $Go_TPL_SIMPLE_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_RUST_RATIO=$(echo "scale=1; $Rust_TPL_SIMPLE_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_PY_RATIO=$(echo "scale=1; $Python_TPL_SIMPLE_MS / $TPL_MIN" | bc 2>/dev/null)
    echo "Template (Simple): Go=${TPL_GO_RATIO}x, Rust=${TPL_RUST_RATIO}x, Python=${TPL_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

# Template Large comparison (lower ms is better)
if [ -n "$Rust_TPL_LARGE_MS" ] && [ -n "$Go_TPL_LARGE_MS" ] && [ -n "$Python_TPL_LARGE_MS" ]; then
    TPL_MIN=$(echo "$Go_TPL_LARGE_MS $Rust_TPL_LARGE_MS $Python_TPL_LARGE_MS" | tr ' ' '\n' | sort -n | head -1)
    TPL_GO_RATIO=$(echo "scale=1; $Go_TPL_LARGE_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_RUST_RATIO=$(echo "scale=1; $Rust_TPL_LARGE_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_PY_RATIO=$(echo "scale=1; $Python_TPL_LARGE_MS / $TPL_MIN" | bc 2>/dev/null)
    echo "Template (Large): Go=${TPL_GO_RATIO}x, Rust=${TPL_RUST_RATIO}x, Python=${TPL_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

# Template ACL comparison (lower ms is better)
if [ -n "$Rust_TPL_ACL_MS" ] && [ -n "$Go_TPL_ACL_MS" ] && [ -n "$Python_TPL_ACL_MS" ]; then
    TPL_MIN=$(echo "$Go_TPL_ACL_MS $Rust_TPL_ACL_MS $Python_TPL_ACL_MS" | tr ' ' '\n' | sort -n | head -1)
    TPL_GO_RATIO=$(echo "scale=1; $Go_TPL_ACL_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_RUST_RATIO=$(echo "scale=1; $Rust_TPL_ACL_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_PY_RATIO=$(echo "scale=1; $Python_TPL_ACL_MS / $TPL_MIN" | bc 2>/dev/null)
    echo "Template (ACL 1K): Go=${TPL_GO_RATIO}x, Rust=${TPL_RUST_RATIO}x, Python=${TPL_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

# Template ACL 10K comparison (lower ms is better)
if [ -n "$Rust_TPL_ACL10K_MS" ] && [ -n "$Go_TPL_ACL10K_MS" ] && [ -n "$Python_TPL_ACL10K_MS" ]; then
    TPL_MIN=$(echo "$Go_TPL_ACL10K_MS $Rust_TPL_ACL10K_MS $Python_TPL_ACL10K_MS" | tr ' ' '\n' | sort -n | head -1)
    TPL_GO_RATIO=$(echo "scale=1; $Go_TPL_ACL10K_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_RUST_RATIO=$(echo "scale=1; $Rust_TPL_ACL10K_MS / $TPL_MIN" | bc 2>/dev/null)
    TPL_PY_RATIO=$(echo "scale=1; $Python_TPL_ACL10K_MS / $TPL_MIN" | bc 2>/dev/null)
    echo "Template (ACL 10K): Go=${TPL_GO_RATIO}x, Rust=${TPL_RUST_RATIO}x, Python=${TPL_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

# Mandelbrot comparison (lower ms is better)
if [ -n "$Rust_CPU_MS" ] && [ -n "$Go_CPU_MS" ] && [ -n "$Python_CPU_MS" ]; then
    CPU_MIN=$(echo "$Go_CPU_MS $Rust_CPU_MS" | tr ' ' '\n' | sort -n | head -1)  # Exclude Python from min
    CPU_GO_RATIO=$(echo "scale=1; $Go_CPU_MS / $CPU_MIN" | bc 2>/dev/null)
    CPU_RUST_RATIO=$(echo "scale=1; $Rust_CPU_MS / $CPU_MIN" | bc 2>/dev/null)
    CPU_PY_RATIO=$(echo "scale=1; $Python_CPU_MS / $CPU_MIN" | bc 2>/dev/null)
    echo "Mandelbrot (CPU): Go=${CPU_GO_RATIO}x, Rust=${CPU_RUST_RATIO}x, Python=${CPU_PY_RATIO}x (1.0x = fastest)" | tee -a "$RESULTS_FILE"
fi

echo "" | tee -a "$RESULTS_FILE"
echo "Full results saved to: $RESULTS_FILE" | tee -a "$RESULTS_FILE"
echo "Build logs saved to: $RESULTS_FILE.build.*"
echo "Test output saved to: $RESULTS_FILE.tests.*"

# Cleanup is handled by trap
log "Done!"
