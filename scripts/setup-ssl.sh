#!/bin/sh
# Obtains (or renews-in-place) the Let's Encrypt certificate for DOMAIN and
# switches Nginx from the HTTP-only bootstrap config to the full HTTPS
# config. Safe to re-run: if a valid certificate already exists it does
# nothing unless --force is passed.
#
# Usage: scripts/setup-ssl.sh [--force] [--staging]
set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

FORCE=false
STAGING=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
    --staging) STAGING=true ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

load_env
require_env_var DOMAIN

NGINX_TEMPLATES_DIR="${ROOT_DIR}/docker/nginx/templates"
NGINX_ACTIVE_DIR="${ROOT_DIR}/docker/nginx/active"
CERT_LIVE_DIR="${ROOT_DIR}/docker/certbot/conf/live/${DOMAIN}"

mkdir -p "$NGINX_ACTIVE_DIR" "${ROOT_DIR}/docker/certbot/www" "${ROOT_DIR}/docker/certbot/conf"

if [ -f "${CERT_LIVE_DIR}/fullchain.pem" ] && [ "$FORCE" != true ]; then
  log "A certificate for ${DOMAIN} already exists (${CERT_LIVE_DIR}). Use --force to re-issue."
  log "Ensuring Nginx is running the HTTPS config..."
  cp "${NGINX_TEMPLATES_DIR}/ssl.conf.template" "${NGINX_ACTIVE_DIR}/default.conf.template"
  compose up -d nginx
  # A full restart, not `nginx -s reload`: Nginx's official image only
  # re-renders templates (envsubst) on container start, so switching which
  # template is active requires restarting the container, not just
  # signalling the already-running process.
  compose restart nginx
  log "Done."
  exit 0
fi

log "Prerequisites for Let's Encrypt to succeed:"
log "  - A DNS A (or AAAA) record for ${DOMAIN} must already point at this server's public IP."
log "  - Ports 80 and 443 must be reachable from the Internet (check firewall / cloud security group)."
printf 'Continue? [y/N] '
read -r CONFIRM
case "$CONFIRM" in
  y|Y) ;;
  *) die "Aborted." ;;
esac

log "Starting Nginx with the HTTP-only bootstrap config (serves the ACME challenge)..."
cp "${NGINX_TEMPLATES_DIR}/http-only.conf.template" "${NGINX_ACTIVE_DIR}/default.conf.template"
compose up -d postgres app nginx
compose restart nginx

STAGING_FLAG=""
if [ "$STAGING" = true ]; then
  STAGING_FLAG="--staging"
  warn "Using Let's Encrypt's staging environment - the resulting certificate will NOT be trusted by browsers."
fi

log "Requesting the certificate from Let's Encrypt for ${DOMAIN}..."
compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "${SMTP_FROM:-admin@${DOMAIN}}" \
  --agree-tos --non-interactive \
  $STAGING_FLAG \
  || die "Certificate issuance failed. Check the DNS record and firewall rules above, then retry."

log "Certificate obtained. Switching Nginx to the HTTPS config..."
cp "${NGINX_TEMPLATES_DIR}/ssl.conf.template" "${NGINX_ACTIVE_DIR}/default.conf.template"
compose restart nginx

log "HTTPS is live at https://${DOMAIN}"
log "Renewal runs automatically via the 'certbot' service (checked every 12h) - see README.md for details."
