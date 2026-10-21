#!/usr/bin/env sh
# Backup of the database and uploaded files (spec §13: backups + tested restore).
#   DATABASE_URL=postgres://… ./scripts/backup.sh [target-dir]
# Without DATABASE_URL the embedded PGlite directory is archived instead (stop the app first).
set -eu
OUT="${1:-backups}/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --no-owner --file="$OUT/db.dump" "$DATABASE_URL"
else
  tar -czf "$OUT/pglite.tar.gz" -C "${PGLITE_DIR:-data/pglite}" .
fi
UPLOADS="${UPLOAD_DIR:-data/uploads}"
[ -d "$UPLOADS" ] && tar -czf "$OUT/uploads.tar.gz" -C "$UPLOADS" .
echo "backup written to $OUT"
