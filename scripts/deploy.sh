#!/bin/sh
# First (and every subsequent) production deployment on a VPS. Safe to
# re-run: it never drops the database or removes volumes.
#
# Usage:
#   git clone <repo> && cd pro-auth
#   cp .env.example .env && nano .env
#   ./scripts/deploy.sh
set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

log "Checking prerequisites..."
check_prerequisites

log "Loading and validating .env..."
load_env
check_required_config

NGINX_ACTIVE_DIR="${ROOT_DIR}/docker/nginx/active"
CERT_LIVE_DIR="${ROOT_DIR}/docker/certbot/conf/live/${DOMAIN}"
mkdir -p "$NGINX_ACTIVE_DIR" "${ROOT_DIR}/docker/certbot/www" "${ROOT_DIR}/docker/certbot/conf"

if [ ! -f "${NGINX_ACTIVE_DIR}/default.conf.template" ]; then
  log "No active Nginx config yet - starting with the HTTP-only bootstrap config."
  cp "${ROOT_DIR}/docker/nginx/templates/http-only.conf.template" "${NGINX_ACTIVE_DIR}/default.conf.template"
fi

log "Building and starting containers (this runs database migrations automatically)..."
compose up -d --build

log "Waiting for the app to report healthy..."
attempt=0
while true; do
  container_id="$(compose ps -q app)"
  status="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    die "App did not become healthy in time (last status: ${status}). Check logs: docker compose -f docker-compose.prod.yml logs app"
  fi
  sleep 3
done
log "App is healthy."

if [ -f "${CERT_LIVE_DIR}/fullchain.pem" ]; then
  log "An SSL certificate for ${DOMAIN} already exists - skipping issuance."
  log "(Run ./scripts/setup-ssl.sh --force if you need to re-issue it.)"
else
  log "No SSL certificate found yet - running setup-ssl.sh..."
  "$SCRIPT_DIR/setup-ssl.sh"
fi

log ""
log "Deployment complete."
log "  App health (internal):  docker compose -f docker-compose.prod.yml exec app curl -sf http://localhost:3000/health"
log "  Public site:             https://${DOMAIN}"
log "  API docs:                https://${DOMAIN}/docs"
log "  Logs:                    docker compose -f docker-compose.prod.yml logs -f"
