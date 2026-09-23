#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " HARMONIA WSL / LINUX CI PARITY QUALIFICATION"
echo "============================================================"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "ERROR: this qualification must run under Linux/WSL."
  exit 2
fi

if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
  echo "Environment: WSL2"
else
  echo "Environment: Linux"
fi

case "$(pwd)" in
  /mnt/*)
    echo
    echo "WARNING: repository is on a Windows-mounted filesystem."
    echo "For the cleanest Linux/native-module parity, prefer a WSL-native clone under ~/repos."
    ;;
esac

command -v node >/dev/null || {
  echo "ERROR: node is missing."
  exit 3
}

command -v corepack >/dev/null || {
  echo "ERROR: corepack is missing."
  exit 3
}

command -v docker >/dev/null || {
  echo "ERROR: docker is missing."
  exit 3
}

docker info >/dev/null

export CI=true
export NX_DAEMON=false
export NX_NO_CLOUD=true

hpnpm() {
  corepack pnpm@12.6.0 "$@"
}

echo
echo "=== TOOLCHAIN ==="
node --version
hpnpm --version
docker --version
docker compose version

echo
echo "=== FROZEN INSTALL ==="
hpnpm install --frozen-lockfile

echo
echo "=== SCRIPT / COMPOSE VALIDATION ==="
hpnpm lint:scripts
hpnpm test:compose

echo
echo "=== UNIT TESTS ==="
hpnpm test

echo
echo "=== STARTUP CONTRACTS + REAL ISOLATED DOCKER LIFECYCLE ==="
RUN_DOCKER_START_TESTS=1 hpnpm test:startup

echo
echo "=== APPLICATION BUILDS ==="
hpnpm build:all

echo
echo "=== LIGHTWEIGHT ENVIRONMENT SMOKE ==="
python3 tests/env_tests/smoke_check.py

echo
echo "============================================================"
echo " HARMONIA_WSL_CI_PARITY_OK"
echo "============================================================"
