#!/usr/bin/env bash

set -euo pipefail

ROOT="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.." &&
  pwd
)"

cd "$ROOT"

wait_for_log() {
  local log="$1"
  local pattern="$2"
  local label="$3"
  local pid="$4"

  for attempt in $(seq 1 120); do
    if grep -Fq "$pattern" "$log" 2>/dev/null; then
      echo "$label"
      return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      # Allow redirected stdout/stderr to finish flushing.
      sleep 0.25

      if grep -Fq "$pattern" "$log" 2>/dev/null; then
        echo "$label"
        return 0
      fi

      echo
      echo "ERROR: start:all exited before expected marker:"
      echo "  $pattern"
      echo
      echo "=== LOG ==="
      cat "$log" 2>/dev/null || true
      return 1
    fi

    sleep 0.25
  done

  echo
  echo "ERROR: timed out waiting for:"
  echo "  $pattern"
  echo
  echo "=== LOG ==="
  cat "$log" 2>/dev/null || true
  return 1
}

require_running_harmonia() {
  echo "Checking existing Harmonia application stack..."

  local backend
  backend="$(
    curl \
      -fsS \
      --max-time 3 \
      http://localhost:3000/api/__health
  )"

  printf '%s' "$backend" |
    grep -Eq \
      '"ok"[[:space:]]*:[[:space:]]*true'

  local frontend
  frontend="$(
    curl \
      -fsS \
      --max-time 3 \
      http://localhost:4200/
  )"

  printf '%s' "$frontend" |
    grep -Eqi \
      '<title>[[:space:]]*Harmonia'

  printf '%s' "$frontend" |
    grep -Eqi \
      '<harmonia-root([[:space:]]|>)'

  echo "EXISTING_HARMONIA_STACK_GREEN"
}

run_reuse_case() {
  local name="$1"
  shift

  local log="/tmp/harmonia-startall-${name}.log"

  rm -f "$log"

  echo
  echo "============================================================"
  echo " CASE: $name"
  echo "============================================================"

  node.exe \
    scripts/start-all.cjs \
    "$@" \
    >"$log" 2>&1 &

  local pid=$!

  echo "pid=$pid"
  echo "log=$log"

  wait_for_log \
    "$log" \
    "Docker worker: clean" \
    "WORKER_REUSE_MARKER_GREEN" \
    "$pid"

  wait_for_log \
    "$log" \
    "Backend: existing Harmonia instance detected" \
    "BACKEND_REUSE_MARKER_GREEN" \
    "$pid"

  wait_for_log \
    "$log" \
    "Frontend: existing Harmonia instance detected" \
    "FRONTEND_REUSE_MARKER_GREEN" \
    "$pid"

  wait_for_log \
    "$log" \
    "Harmonia already running." \
    "IDEMPOTENT_COMPLETION_MARKER_GREEN" \
    "$pid"

  if ! wait "$pid"; then
    echo
    echo "ERROR: start:all returned non-zero"
    cat "$log"
    return 1
  fi

  echo
  echo "=== $name LOG ==="
  cat "$log"

  echo
  echo "${name}_GREEN"
}

echo
echo "=== 1. PRECONDITION ==="

require_running_harmonia

echo
echo "=== 2. DEFAULT AUTO-GPU REUSE ==="

run_reuse_case \
  "AUTO_GPU"

echo
echo "=== 3. --nogpu REUSE ==="

run_reuse_case \
  "NOGPU" \
  --nogpu

grep -Fq \
  "GPU mode: disabled by --nogpu." \
  /tmp/harmonia-startall-NOGPU.log

echo "NOGPU_OVERRIDE_MARKER_GREEN"

echo
echo "=== 4. FINAL HEALTH ==="

curl \
  -fsS \
  http://localhost:3000/api/__health

echo

curl \
  -fsS \
  http://localhost:4200/api/__health

echo

echo
echo "============================================================"
echo " START:ALL LIVE IDEMPOTENCE QUALIFIED"
echo "============================================================"
echo " worker_reuse        = GREEN"
echo " backend_reuse       = GREEN"
echo " frontend_reuse      = GREEN"
echo " auto_gpu_reuse      = GREEN"
echo " nogpu_reuse         = GREEN"
echo " qualification_race  = FIXED"
echo "============================================================"
