#!/usr/bin/env sh
# Restore a backup made by backup.sh.   DATABASE_URL=postgres://… ./scripts/restore.sh backups/20260101-120000
# The target database is overwritten (pg_restore --clean). Stop the application first.
set -eu
DIR="$1"
if [ -f "$DIR/db.dump" ]; then
  pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DIR/db.dump"
elif [ -f "$DIR/pglite.tar.gz" ]; then
  T="${PGLITE_DIR:-data/pglite}"; rm -rf "$T"; mkdir -p "$T"; tar -xzf "$DIR/pglite.tar.gz" -C "$T"
fi
if [ -f "$DIR/uploads.tar.gz" ]; then
  U="${UPLOAD_DIR:-data/uploads}"; mkdir -p "$U"; tar -xzf "$DIR/uploads.tar.gz" -C "$U"
fi
echo "restored from $DIR"
