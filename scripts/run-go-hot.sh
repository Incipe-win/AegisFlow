#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: scripts/run-go-hot.sh <service-dir> <air-config>" >&2
  exit 1
fi

SERVICE_DIR="$1"
CONFIG_PATH="$2"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_ABS="$ROOT_DIR/$CONFIG_PATH"
SERVICE_ABS="$ROOT_DIR/$SERVICE_DIR"

cd "$SERVICE_ABS"

if command -v air >/dev/null 2>&1; then
  AIR_BIN="$(command -v air)"
else
  GOPATH_BIN="$(go env GOPATH)/bin/air"
  if [[ ! -x "$GOPATH_BIN" ]]; then
    echo "air not found, installing github.com/air-verse/air@latest ..."
    if ! GOBIN="$(go env GOPATH)/bin" go install github.com/air-verse/air@latest; then
      echo "air install failed, falling back to 'go run .' without hot reload" >&2
      exec go run .
    fi
  fi
  AIR_BIN="$GOPATH_BIN"
fi

AIR_CONFIG="$CONFIG_ABS"
SERVICE_TMP_DIR="$SERVICE_ABS/tmp"

if [[ -e "$SERVICE_TMP_DIR" && ! -w "$SERVICE_TMP_DIR" ]]; then
  SERVICE_SLUG="${SERVICE_DIR//\//-}"
  FALLBACK_TMP_DIR="/tmp/aegisflow-air/$SERVICE_SLUG"
  FALLBACK_CONFIG="/tmp/aegisflow-air/$SERVICE_SLUG.air.toml"

  mkdir -p "$FALLBACK_TMP_DIR"

  sed \
    -e "s#^tmp_dir = \".*\"#tmp_dir = \"$FALLBACK_TMP_DIR\"#" \
    -e "s#\\./tmp/#$FALLBACK_TMP_DIR/#g" \
    "$CONFIG_ABS" > "$FALLBACK_CONFIG"

  AIR_CONFIG="$FALLBACK_CONFIG"
  echo "tmp dir $SERVICE_TMP_DIR is not writable, using $FALLBACK_TMP_DIR instead"
elif [[ ! -e "$SERVICE_TMP_DIR" ]]; then
  mkdir -p "$SERVICE_TMP_DIR"
fi

exec "$AIR_BIN" -c "$AIR_CONFIG"
