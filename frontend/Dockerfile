# Image de production du frontend : build Next.js standalone, exécution non-root.

FROM mirror.gcr.io/library/node:26-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM mirror.gcr.io/library/node:26-bookworm-slim AS build
WORKDIR /app
# Destination du relais /api, figée au build par next.config.ts (nom du service compose).
ARG API_URL=http://backend:8000
ENV API_URL=$API_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM mirror.gcr.io/library/node:26-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# UID/GID numériques : résolubles par l'hôte et par les politiques runAsNonRoot (hadolint DL3066).
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid 10001 --home /app app
WORKDIR /app
COPY --from=build --chown=10001:10001 /app/.next/standalone ./
COPY --from=build --chown=10001:10001 /app/.next/static ./.next/static
COPY --from=build --chown=10001:10001 /app/public ./public
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]
