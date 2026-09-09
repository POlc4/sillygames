#!/usr/bin/env bash
# Sauvegarde Postgres : pg_dump compressé dans ./backups, rotation sur 7 jours.
# Lancé par cron chaque nuit, et par le workflow backup.yml qui rapatrie le dernier fichier.
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR=./backups
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/sillygames-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
docker compose exec -T postgres pg_dump -U sillygames -d sillygames --no-owner | gzip -9 > "$FILE"
ln -sf "$(basename "$FILE")" "$BACKUP_DIR/latest.sql.gz"
find "$BACKUP_DIR" -name 'sillygames-*.sql.gz' -mtime +7 -delete
echo "$(date -Is) ok $FILE ($(du -h "$FILE" | cut -f1))"
