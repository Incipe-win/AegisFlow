#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait || true
}

trap cleanup EXIT INT TERM

docker compose up -d mysql etcd minio milvus
npm run generate:api

declare -a PIDS=()

bash scripts/run-go-hot.sh apps/mcp apps/mcp/.air.toml &
PIDS+=($!)

bash scripts/run-go-hot.sh apps/api apps/api/.air.toml &
PIDS+=($!)

npm run dev:web &
PIDS+=($!)

wait -n "${PIDS[@]}"
