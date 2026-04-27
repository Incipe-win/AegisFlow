#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== AegisFlow Production Deploy ==="

if [ ! -f .env ]; then
  if [ -f .env.production.example ]; then
    echo ">> Creating .env from .env.production.example"
    cp .env.production.example .env
    echo ">> Please edit .env with your actual credentials, then re-run this script."
    exit 0
  else
    echo "ERROR: .env not found and .env.production.example missing"
    exit 1
  fi
fi

echo ">> Building Docker images..."
docker compose -f docker-compose.prod.yml build --pull

echo ">> Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "=== AegisFlow deployed ==="
echo "Access at:"
echo "  https://incipe.top"
echo "  https://incipt.top:2053"
echo ""
echo "Useful commands:"
echo "  npm run prod:logs    # View all logs"
echo "  npm run prod:down    # Stop all services"
