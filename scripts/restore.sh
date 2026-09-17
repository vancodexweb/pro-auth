#!/bin/sh
# Restores a backup produced by scripts/backup.sh into the running
# postgres container.
#
# THIS IS DESTRUCTIVE: it drops and recreates every table in the target
# database before loading the dump. It refuses to run without --yes.
#
# Usage: scripts/restore.sh <path-to-backup.sql.gz> --yes
set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

BACKUP_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

[ -n "$BACKUP_FILE" ] || die "Usage: scripts/restore.sh <path-to-backup.sql.gz> --yes"
[ -f "$BACKUP_FILE" ] || die "File not found: ${BACKUP_FILE}"
if [ "$CONFIRM_FLAG" != "--yes" ]; then
  die "This overwrites the current database. Re-run with --yes to confirm: scripts/restore.sh ${BACKUP_FILE} --yes"
fi

load_env
require_env_var DATABASE_NAME
require_env_var DATABASE_USER

warn "This will DROP and recreate every table in database '${DATABASE_NAME}' before loading ${BACKUP_FILE}."
warn "Consider taking a fresh backup first: scripts/backup.sh"

log "Restoring..."
{
  echo "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
  gunzip -c "$BACKUP_FILE"
} | compose exec -T postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 -f -

log "Restore complete. Verify with: docker compose -f docker-compose.prod.yml exec app npm run migration:run:prod"
log "(re-running migrations is a no-op if the restored dump is already up to date, and confirms the schema matches this codebase)"
