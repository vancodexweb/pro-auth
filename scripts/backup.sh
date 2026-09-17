#!/bin/sh
# Creates a timestamped, compressed pg_dump of the production database
# under ./backups/. Never deletes old backups - retention is a deliberate
# decision for a human to make, documented in README.md.
#
# Usage: scripts/backup.sh
set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

load_env
require_env_var DATABASE_NAME
require_env_var DATABASE_USER

BACKUP_DIR="${ROOT_DIR}/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/${DATABASE_NAME}-${TIMESTAMP}.sql.gz"

log "Dumping database '${DATABASE_NAME}' from the postgres container..."
compose exec -T postgres pg_dump -U "$DATABASE_USER" -d "$DATABASE_NAME" --format=plain \
  | gzip > "$OUT_FILE"

log "Backup written to ${OUT_FILE} ($(du -h "$OUT_FILE" | cut -f1))"
log "Old backups are kept indefinitely - delete manually once you no longer need them."
