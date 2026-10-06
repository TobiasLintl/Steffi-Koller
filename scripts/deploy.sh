#!/usr/bin/env bash
# Deploys the current main branch on the server.
#   ./scripts/deploy.sh                 → production (.env.production)
#   ./scripts/deploy.sh .env.staging    → staging
set -euo pipefail

ENV_FILE="${1:-.env.production}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
export ENV_FILE

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE (copy from .env.example)"; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

echo "▸ Backup before deployment"
if "${COMPOSE[@]}" ps --status running --services | grep -q '^worker$'; then
  "${COMPOSE[@]}" exec -T worker pnpm backup
else
  echo "  (worker not running yet – skipped)"
fi

echo "▸ Update code"
git fetch --tags origin
git pull --ff-only

echo "▸ Build images ($(git rev-parse --short HEAD))"
export IMAGE_TAG="$(git rev-parse --short HEAD)"
"${COMPOSE[@]}" build

echo "▸ Migrate and restart"
"${COMPOSE[@]}" up -d --remove-orphans

echo "▸ Health check"
for i in $(seq 1 30); do
  if curl -fsS "https://${SITE_DOMAIN}/api/health" >/dev/null 2>&1; then
    echo "  OK – ${SITE_DOMAIN} is up (${IMAGE_TAG})"
    exit 0
  fi
  sleep 2
done
echo "  Health check failed – see: ${COMPOSE[*]} logs app"
exit 1
