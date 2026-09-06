#!/bin/bash
# Exécuté une fois après la création du devcontainer.
set -euo pipefail

git config --global --add safe.directory /workspace

echo ">>> Python 3.12 via uv"
uv python install 3.12

echo ">>> pre-commit"
uv tool install pre-commit
pre-commit install --install-hooks

if [ -f backend/pyproject.toml ]; then
  echo ">>> backend : uv sync"
  (cd backend && uv sync)
fi

if [ -f frontend/package.json ]; then
  echo ">>> frontend : npm ci"
  (cd frontend && npm ci)
fi

echo ">>> versions"
uv --version
node --version
docker --version
hadolint --version
gitleaks version
echo "Devcontainer prêt."
