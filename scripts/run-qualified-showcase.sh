#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

hpnpm() {
  corepack pnpm@12.6.0 "$@"
}

export NX_ISOLATE_PLUGINS=false
export NX_DAEMON=false
export NX_NO_CLOUD=true

OUT="generated/qualified-showcase"
PORT=3114
BASE="http://localhost:${PORT}"
FRONTEND="http://localhost:4200"
BACKEND_PID=""

mkdir -p "$OUT"

cleanup() {
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo
    echo "Stopping showcase-owned backend pid=$BACKEND_PID on port $PORT..."
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

diagnostics() {
  echo
  echo "============================================================"
  echo " SHOWCASE FAILURE DIAGNOSTICS"
  echo "============================================================"

  echo
  echo "=== BACKEND HEALTH ==="
  curl --silent "${BASE}/api/__health" || true
  echo

  echo
  echo "=== RUNTIME STATUS ==="
  curl --silent "${BASE}/api/music/runtime/status" || true
  echo

  echo
  echo "=== BACKEND LOG TAIL ==="
  tail -320 "$OUT/backend-3114.log" 2>/dev/null || true

  echo
  echo "=== MODEL PROVIDER CONTAINERS ==="
  docker ps -a \
    --filter name=harmonia-musicgen \
    --filter name=harmonia-diffsinger \
    --filter name=harmonia-stable-audio-3 \
    --filter name=harmonia-ace-step-1.5 \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' \
    || true

  for container in \
    harmonia-musicgen \
    harmonia-diffsinger \
    harmonia-stable-audio-3 \
    harmonia-ace-step-1.5
  do
    if docker inspect "$container" >/dev/null 2>&1; then
      echo
      echo "=== ${container} LOG TAIL ==="
      docker logs --tail 120 "$container" 2>&1 || true
    fi
  done
}

echo "============================================================"
echo " HARMONIA QUALIFIED GENERATOR SHOWCASE - FRESH BACKEND"
echo "============================================================"

echo
echo "1. CLEAN TREE"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: working tree is not clean."
  git status --short
  exit 1
fi

echo
echo "2. STATIC CONTRACT"
node --test scripts/runtime-contract.test.cjs
echo "SHOWCASE_STATIC_CONTRACT_GREEN"

echo
echo "3. FRONTEND PREFLIGHT"
curl --fail --silent --show-error "$FRONTEND" >/dev/null
echo "SHOWCASE_FRONTEND_READY"

echo
echo "4. DEDICATED BACKEND PORT PREFLIGHT"
if curl --silent --fail "${BASE}/api/__health" >/dev/null 2>&1; then
  echo "STOP: port $PORT already has a Harmonia backend."
  exit 1
fi

if netstat -ano 2>/dev/null | grep -Eq "[:.]$PORT[[:space:]].*LISTENING"; then
  echo "STOP: port $PORT is already occupied:"
  netstat -ano | grep -E "[:.]$PORT[[:space:]].*LISTENING" || true
  exit 1
fi

echo "SHOWCASE_PORT_${PORT}_FREE"

echo
echo "5. BUILD CURRENT BACKEND"
hpnpm build:backend
echo "SHOWCASE_BACKEND_BUILD_GREEN"

echo
echo "6. START FRESH CURRENT BACKEND"
PORT="$PORT" \
API_PREFIX=api \
HARMONIA_GPU_ENABLED=true \
  node dist/apps/backend/main.js \
  > "$OUT/backend-3114.log" \
  2>&1 &

BACKEND_PID=$!
echo "backend pid=$BACKEND_PID"

READY=0
for _ in $(seq 1 90); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "STOP: showcase backend exited before readiness."
    diagnostics
    exit 1
  fi

  if curl --silent --fail "${BASE}/api/__health" >/dev/null 2>&1; then
    READY=1
    break
  fi

  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "STOP: showcase backend did not become ready."
  diagnostics
  exit 1
fi

echo "SHOWCASE_FRESH_BACKEND_READY"

echo
echo "7. GENERATE ALL QUALIFIED MODEL SAMPLES"
set +e
HARMONIA_SHOWCASE_BACKEND_BASE="$BASE" \
HARMONIA_SHOWCASE_FRONTEND_BASE="$FRONTEND" \
  hpnpm showcase:qualified-generators \
  2>&1 | tee "$OUT/showcase.log"
SHOWCASE_STATUS="${PIPESTATUS[0]}"
set -e

if [[ "$SHOWCASE_STATUS" -ne 0 ]]; then
  echo
  echo "SHOWCASE_GENERATION_FAILED status=$SHOWCASE_STATUS"
  diagnostics
  exit "$SHOWCASE_STATUS"
fi

echo
echo "8. OUTPUT INVENTORY"
find exports/showcase \
  -maxdepth 2 \
  -type f \
  -print \
  2>/dev/null \
  | sort

echo
echo "9. LATEST MANIFEST SUMMARY"
LATEST_MANIFEST="$(
  find exports/showcase \
    -maxdepth 1 \
    -type f \
    -name '*--qualified-generators.manifest.json' \
    -print \
    2>/dev/null \
    | sort \
    | tail -1
)"

if [[ -z "$LATEST_MANIFEST" ]]; then
  echo "STOP: showcase completed but no manifest was found."
  exit 1
fi

node - "$LATEST_MANIFEST" <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

console.log(`date = ${manifest.date}`);
for (const result of manifest.results || []) {
  console.log(
    [
      result.modelId.padEnd(32),
      String(result.wav?.channels ?? '?') + 'ch',
      String(result.wav?.sampleRate ?? '?') + 'Hz',
      Number(result.wav?.durationSeconds ?? 0).toFixed(2) + 's',
      result.showcasePath,
    ].join('  ')
  );
}

if ((manifest.results || []).length !== 5) {
  throw new Error(
    `Expected five showcase results, received ${(manifest.results || []).length}`
  );
}

console.log('QUALIFIED_GENERATOR_SHOWCASE_MANIFEST_5_OF_5_OK');
NODE

echo
echo "============================================================"
echo " QUALIFIED GENERATOR SHOWCASE: GREEN"
echo "============================================================"
echo " backend = fresh current branch on $PORT"
echo " songs   = 5/5"
echo " manifest = $LATEST_MANIFEST"
echo "============================================================"
