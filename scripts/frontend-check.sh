#!/usr/bin/env bash
# Format, lint, types, tests avec couverture et build du frontend dans un conteneur Node jetable.
# Aucun Node requis sur l'hôte.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/npm-cache -e NEXT_TELEMETRY_DISABLED=1 \
  -v "$PWD":/app -w /app \
  node:22-bookworm-slim \
  sh -c '
    set -e
    [ -d node_modules ] || npm ci --no-audit --no-fund
    echo "--- prettier";  npm run -s format:check
    echo "--- eslint";    npm run -s lint
    echo "--- tsc";       npm run -s typecheck
    echo "--- vitest";    npm run -s test:coverage
    echo "--- build";     npm run -s build
  '
