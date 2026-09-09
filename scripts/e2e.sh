#!/usr/bin/env bash
# Tests bout en bout : construit et démarre la stack compose, puis lance Playwright
# dans l'image officielle (navigateurs inclus), en réseau hôte. Aucun Node requis sur l'hôte.
set -euo pipefail
cd "$(dirname "$0")/.."

PLAYWRIGHT_VERSION=$(sed -n 's/.*"@playwright\/test": "\^\?\([0-9.]*\)".*/\1/p' frontend/package.json)

docker compose up --build -d --wait
trap 'docker compose down' EXIT

docker run --rm --network host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e CI="${CI:-}" \
  -v "$PWD/frontend":/app -w /app \
  "mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble" \
  npx playwright test "$@"
