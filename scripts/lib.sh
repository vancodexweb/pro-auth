#!/bin/sh
# Shared helpers for scripts/*.sh. Not meant to be run directly.
set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[deploy] WARNING:\033[0m %s\n' "$1"; }
die()  { printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$1" >&2; exit 1; }

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

require_env_var() {
  var_name="$1"
  eval "value=\${${var_name}:-}"
  if [ -z "$value" ]; then
    die "Required variable ${var_name} is not set in .env"
  fi
}

load_env() {
  [ -f "$ENV_FILE" ] || die ".env not found. Run: cp .env.example .env  (then edit it)"
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
}

check_prerequisites() {
  command -v docker >/dev/null 2>&1 || die "Docker is not installed. See https://docs.docker.com/engine/install/"
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is not available (try: docker compose version)"
}

check_required_config() {
  require_env_var DOMAIN
  require_env_var DATABASE_NAME
  require_env_var DATABASE_USER
  require_env_var DATABASE_PASSWORD
  require_env_var JWT_ACCESS_SECRET
  require_env_var JWT_REFRESH_SECRET
  require_env_var SMTP_HOST
  require_env_var SMTP_USER
  require_env_var SMTP_PASSWORD

  if [ "$DOMAIN" = "example.com" ]; then
    die "DOMAIN is still set to the placeholder 'example.com' in .env - set it to your real domain"
  fi
  case "$JWT_ACCESS_SECRET" in
    *change-me*) die "JWT_ACCESS_SECRET is still a placeholder - generate a real one (openssl rand -base64 48)" ;;
  esac
  case "$JWT_REFRESH_SECRET" in
    *change-me*) die "JWT_REFRESH_SECRET is still a placeholder - generate a real one (openssl rand -base64 48)" ;;
  esac
  case "$DATABASE_PASSWORD" in
    change-me) die "DATABASE_PASSWORD is still the placeholder 'change-me' - set a real password" ;;
  esac
}
