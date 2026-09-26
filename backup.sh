#!/bin/sh
# Backup diário dos dados do painel (posts.json, config.json com o hash da senha
# e as imagens enviadas) — volume Docker do site. Mantém os últimos 14 dias.
#
# Agendar (crontab do usuário na VPS):
#   30 3 * * * /opt/stacks/pl-ambiental/backup.sh >> /opt/backups/pl-ambiental/backup.log 2>&1
#
# Restaurar (com o site parado):
#   docker compose -f docker-compose.vps.yml down
#   docker run --rm -v pl-ambiental_pl_ambiental_data:/data -v /opt/backups/pl-ambiental:/backup alpine:3 \
#     sh -c 'rm -rf /data/* && tar xzf /backup/ARQUIVO.tar.gz -C /data'
#   docker compose -f docker-compose.vps.yml up -d
set -eu

VOL="pl-ambiental_pl_ambiental_data"
DEST="/opt/backups/pl-ambiental"
KEEP_DAYS=14

mkdir -p "$DEST"
chmod 700 "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="pl-ambiental-$STAMP.tar.gz"

docker run --rm --user "$(id -u):$(id -g)" -v "$VOL":/data:ro -v "$DEST":/backup alpine:3 \
  sh -c "umask 077 && tar czf /backup/$FILE -C /data ."

find "$DEST" -name 'pl-ambiental-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) backup ok: $FILE ($(du -h "$DEST/$FILE" | cut -f1))"
