#!/bin/sh
# Applique les migrations puis lance l'API. `exec` pour que uvicorn reçoive les signaux (arrêt propre).
set -eu

echo "Applying database migrations..."
alembic upgrade head

exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips='*'
