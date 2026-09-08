#!/usr/bin/env bash
# Lint, types, migrations et tests du backend dans un conteneur uv jetable.
# Aucun Python requis sur l'hôte. Postgres doit tourner : docker compose up -d postgres
set -euo pipefail
cd "$(dirname "$0")/../backend"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --network sillygames_default \
  -e HOME=/tmp -e UV_CACHE_DIR=/tmp/uv-cache -e UV_LINK_MODE=copy \
  -e DATABASE_URL=postgresql+psycopg://sillygames:sillygames@postgres:5432/sillygames \
  -v "$PWD":/app -w /app \
  ghcr.io/astral-sh/uv:python3.12-bookworm-slim \
  sh -c '
    set -e
    uv sync --quiet
    echo "--- ruff check";   uv run ruff check .
    echo "--- ruff format";  uv run ruff format --check .
    echo "--- mypy";         uv run mypy
    echo "--- alembic";      uv run alembic upgrade head && uv run alembic check
    echo "--- pytest";       uv run pytest -q "$@"
  ' -- "$@"
