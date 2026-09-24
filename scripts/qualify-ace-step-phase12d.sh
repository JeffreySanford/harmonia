#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

hpnpm() {
  corepack pnpm@12.6.0 "$@"
}

export NX_ISOLATE_PLUGINS=false
export NX_DAEMON=false
export NX_NO_CLOUD=true

# Git Bash/MSYS rewrites POSIX-looking arguments passed to Windows executables.
# Docker container paths must remain literal /workspace/... paths.
export MSYS_NO_PATHCONV=1

OUT="generated/ace-step-phase12d"
MODEL_ID="acestep-v15-turbo-06b"
PORT=3112
BASE="http://localhost:${PORT}"
FRONTEND="http://localhost:4200"
NODE_BIN="$(type -P node.exe 2>/dev/null || type -P node 2>/dev/null)"
BACKEND_PID=""
BACKEND_MODE=""

mkdir -p "$OUT"

if [[ -z "$NODE_BIN" ]]; then
  echo "STOP: Node executable not found."
  exit 1
fi

start_isolated_backend() {
  echo "Starting current backend on port $PORT..."

  PORT="$PORT" \
  API_PREFIX=api \
  HARMONIA_GPU_ENABLED=true \
    "$NODE_BIN" dist/apps/backend/main.js \
    > "$OUT/backend-isolated-3112-phase12d.log" \
    2>&1 &

  BACKEND_PID=$!

  for _ in $(seq 1 90); do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "STOP: isolated backend exited."
      cat "$OUT/backend-isolated-3112-phase12d.log"
      exit 1
    fi

    if curl --silent --fail "${BASE}/api/__health" >/dev/null 2>&1; then
      BACKEND_MODE="started"
      return
    fi

    sleep 1
  done

  echo "STOP: isolated backend failed readiness."
  tail -240 "$OUT/backend-isolated-3112-phase12d.log" || true
  exit 1
}

echo "============================================================"
echo " HARMONIA PHASE 12D - REPO-OWNED CONTINUATION"
echo "============================================================"

echo
echo "1. CLEAN TREE"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: working tree is not clean."
  git status --short
  exit 1
fi

echo
echo "2. CURRENT BACKEND"
if curl --silent --fail "${BASE}/api/__health" >/dev/null 2>&1; then
  BACKEND_MODE="reused"
  echo "Reusing healthy Harmonia backend on $PORT."
else
  if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -Eq "[:.]$PORT[[:space:]]"; then
    echo "STOP: port $PORT is occupied but not serving a healthy Harmonia backend."
    exit 1
  fi

  hpnpm build:backend
  start_isolated_backend
fi

echo "PHASE12D_CURRENT_BACKEND_READY mode=$BACKEND_MODE"

echo
echo "3. CURRENT ACE CATALOG"
curl --fail --silent --show-error \
  "${BASE}/api/music/runtime/catalog" \
  > "$OUT/catalog-phase12d-script.json"

"$NODE_BIN" - "$OUT/catalog-phase12d-script.json" <<'NODE'
const fs = require('node:fs');
const catalog = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ace = catalog.models.find((model) => model.id === 'acestep-v15-turbo-06b');

if (
  !ace ||
  ace.availability !== 'installed' ||
  ace.installationState !== 'verified' ||
  ace.installationArtifactCount !== 2 ||
  ace.installationVerifiedCount !== 2 ||
  ace.selectable !== true
) {
  throw new Error(`ACE-Step catalog invalid: ${JSON.stringify(ace)}`);
}

console.log('PHASE12D_CURRENT_BACKEND_ACE_SELECTABLE_OK');
NODE

echo
echo "4. FRONTEND"
curl --fail --silent --show-error "$FRONTEND" >/dev/null
echo "PHASE12D_EXISTING_FRONTEND_READY"

echo
echo "5. ACE PROVIDER"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.gpu.yml \
  --profile model-ace-step-1.5 \
  up --detach --no-build --wait --wait-timeout 180 \
  ace-step-1.5

docker exec harmonia-ace-step-1.5 \
  curl --fail --silent \
  http://127.0.0.1:8001/health \
  > "$OUT/provider-health-before-phase12d.json"

echo "PHASE12D_PROVIDER_HEALTHY_OK"

echo
echo "6. READ-ONLY CLIENT MOUNT"

echo "=== ACE MOUNTS ==="
docker inspect \
  --format '{{json .Mounts}}' \
  harmonia-ace-step-1.5 \
  > "$OUT/ace-mounts.json"

cat "$OUT/ace-mounts.json"
echo

MOUNT_STATE="$(
  "$NODE_BIN" - "$OUT/ace-mounts.json" <<'NODE'
const fs = require('node:fs');
const mounts = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const scripts = mounts.find((mount) => mount.Destination === '/workspace/scripts');
if (scripts) {
  process.stdout.write(`${scripts.Destination}|${scripts.RW}`);
}
NODE
)"

if [[ "$MOUNT_STATE" != "/workspace/scripts|false" ]]; then
  echo "STOP: expected /workspace/scripts read-only bind; observed '$MOUNT_STATE'."
  exit 1
fi

echo "PHASE12D_SCRIPT_MOUNT_READ_ONLY_OK"

echo "=== CLIENT FILE ==="
if ! docker exec harmonia-ace-step-1.5 \
  test -f /workspace/scripts/ace_step_provider_client.py
then
  echo "STOP: ACE provider client file is not visible inside the container."
  echo "Directory listing:"
  docker exec harmonia-ace-step-1.5 \
    sh -lc 'ls -la /workspace/scripts || true'
  exit 1
fi

docker exec harmonia-ace-step-1.5 \
  ls -l /workspace/scripts/ace_step_provider_client.py

echo "PHASE12D_PROVIDER_CLIENT_FILE_OK"

echo "=== IN-MEMORY PYTHON COMPILE ==="
if ! docker exec harmonia-ace-step-1.5 \
  /opt/ACE-Step-1.5/.venv/bin/python \
  -c 'p="/workspace/scripts/ace_step_provider_client.py"; s=open(p,encoding="utf-8").read(); compile(s,p,"exec"); print("ACE_STEP_CLIENT_IN_MEMORY_COMPILE_OK")'
then
  echo "STOP: ACE provider client failed in-memory Python compilation."
  exit 1
fi

echo "=== CLIENT HELP ==="
if ! docker exec harmonia-ace-step-1.5 \
  /opt/ACE-Step-1.5/.venv/bin/python \
  /workspace/scripts/ace_step_provider_client.py \
  --help \
  > "$OUT/client-help-phase12d.txt"
then
  echo "STOP: ACE provider client --help failed."
  exit 1
fi

for argument in --output --duration --model --prompt --lyrics --bpm --vocal-language --seed; do
  if ! grep -q -- "$argument" "$OUT/client-help-phase12d.txt"; then
    echo "STOP: ACE provider client help is missing $argument."
    exit 1
  fi
done

echo "PHASE12D_PROVIDER_CLIENT_GREEN"

echo
echo "7. OPERATIONAL WEIGHTS"
"$NODE_BIN" scripts/model-manager.cjs verify \
  --model "$MODEL_ID" \
  --root models \
  --offline \
  --json \
  > "$OUT/model-verify-before-phase12d.json"

"$NODE_BIN" - "$OUT/model-verify-before-phase12d.json" <<'NODE'
const fs = require('node:fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (
  !r.ok ||
  r.summary.selectedArtifacts !== 2 ||
  r.summary.verified !== 2 ||
  r.summary.missing !== 0 ||
  r.summary.corrupt !== 0
) {
  throw new Error(`ACE operational weights invalid: ${JSON.stringify(r.summary)}`);
}

console.log('PHASE12D_OPERATIONAL_WEIGHTS_2_OF_2_OK');
NODE

echo
echo "============================================================"
echo " 8. REAL 30-SECOND ACE-STEP SONG"
echo "============================================================"
echo "Backend:  $BASE"
echo "Frontend: $FRONTEND"
echo "Model:    ACE-Step 1.5 Turbo + 0.6B LM"
echo "Duration: 30 seconds"
echo "BPM:      118"
echo "Seed:     12012026"
echo "Lyrics:   supplied"
echo

set +e
HARMONIA_QUALIFY_BACKEND_BASE="$BASE" \
HARMONIA_QUALIFY_FRONTEND_BASE="$FRONTEND" \
  hpnpm qualify:ace-step-job \
  2>&1 | tee "$OUT/qualification-phase12d-script.log"
QUALIFY_STATUS="${PIPESTATUS[0]}"
set -e

if [[ "$QUALIFY_STATUS" -ne 0 ]]; then
  echo
  echo "ACE_STEP_JOB_QUALIFICATION_FAILED status=$QUALIFY_STATUS"
  echo
  echo "=== ACE HEALTH ==="
  docker exec harmonia-ace-step-1.5 \
    curl --silent http://127.0.0.1:8001/health || true
  echo
  echo "=== ACE LOG TAIL ==="
  docker logs --tail 320 harmonia-ace-step-1.5 2>&1 || true
  echo
  echo "=== ISOLATED BACKEND LOG TAIL ==="
  if [[ -f "$OUT/backend-isolated-3112-phase12d.log" ]]; then
    tail -320 "$OUT/backend-isolated-3112-phase12d.log" || true
  fi
  exit "$QUALIFY_STATUS"
fi

echo
echo "9. POST-SONG RESIDENT STATE"
docker exec harmonia-ace-step-1.5 \
  curl --fail --silent \
  http://127.0.0.1:8001/health \
  > "$OUT/provider-health-after-phase12d.json"

"$NODE_BIN" - "$OUT/provider-health-after-phase12d.json" <<'NODE'
const fs = require('node:fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (
  r.code !== 200 ||
  r.error !== null ||
  r.data?.models_initialized !== true ||
  r.data?.llm_initialized !== true ||
  r.data?.loaded_model !== 'acestep-v15-turbo' ||
  r.data?.loaded_lm_model !== 'acestep-5Hz-lm-0.6B'
) {
  throw new Error(`ACE resident state invalid: ${JSON.stringify(r)}`);
}

console.log('PHASE12D_PROVIDER_STILL_RESIDENT_OK');
NODE

echo
echo "10. POST-SONG MODEL VERIFY"
if find models/ace-step-1.5 -type f -name '*.incomplete' -print | grep -q .; then
  echo "STOP: runtime model-download tempfiles found."
  exit 1
fi

"$NODE_BIN" scripts/model-manager.cjs verify \
  --model "$MODEL_ID" \
  --root models \
  --offline \
  --json \
  > "$OUT/model-verify-after-phase12d.json"

"$NODE_BIN" - "$OUT/model-verify-after-phase12d.json" <<'NODE'
const fs = require('node:fs');
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (!r.ok || r.summary.selectedArtifacts !== 2 || r.summary.verified !== 2) {
  throw new Error(`ACE verification regressed: ${JSON.stringify(r.summary)}`);
}

console.log('PHASE12D_MODEL_WEIGHTS_STILL_VERIFIED_OK');
NODE

echo
echo "11. FINAL GIT STATE"
git status --short

if [[ -n "$(git status --porcelain)" ]]; then
  echo "STOP: qualification dirtied repository."
  exit 1
fi

echo
echo "============================================================"
echo " PHASE 12D ACE-STEP REAL SONG: GREEN"
echo "============================================================"
echo " backend                     = current branch on $PORT ($BACKEND_MODE)"
echo " frontend                    = existing Harmonia on 4200"
echo " client mount                = read-only"
echo " durable job                 = completed"
echo " supplied lyrics             = preserved"
echo " thinking / 0.6B LM          = exercised"
echo " DiT                         = acestep-v15-turbo"
echo " LM                          = acestep-5Hz-lm-0.6B"
echo " requested duration          = 30 seconds"
echo " output                      = real RIFF/WAV"
echo " provider resident after job = yes"
echo " runtime model downloads     = none"
echo "============================================================"
echo
echo "ACE-Step is intentionally left resident."
