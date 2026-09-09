# Image de production du backend : dépendances résolues avec uv, exécution non-root.

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0
WORKDIR /app
# Dépendances d'abord (cache Docker), code ensuite.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev
COPY . .

FROM mirror.gcr.io/library/python:3.12-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"
# UID/GID numériques : résolubles par l'hôte et par les politiques runAsNonRoot (hadolint DL3066).
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid 10001 --home /app app
WORKDIR /app
COPY --from=builder --chown=10001:10001 /app /app
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"]
ENTRYPOINT ["./entrypoint.sh"]
