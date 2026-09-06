# Image d'outillage du devcontainer. Ne sert JAMAIS de base aux images de prod (backend/, frontend/).
# Python est géré par uv (uv python install), Node par la feature devcontainer.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ARG HADOLINT_VERSION=2.12.0
ARG GITLEAKS_VERSION=8.21.2

# postgresql-client : psql pour inspecter la base depuis le conteneur.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# hadolint : lint des Dockerfiles (binaire selon l'architecture).
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in amd64) h=x86_64 ;; arm64) h=arm64 ;; *) echo "arch $arch non supportée" && exit 1 ;; esac \
    && curl -fsSL -o /usr/local/bin/hadolint \
        "https://github.com/hadolint/hadolint/releases/download/v${HADOLINT_VERSION}/hadolint-Linux-${h}" \
    && chmod +x /usr/local/bin/hadolint

# gitleaks : détection de secrets.
RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in amd64) g=x64 ;; arm64) g=arm64 ;; *) echo "arch $arch non supportée" && exit 1 ;; esac \
    && curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${g}.tar.gz" \
        | tar -xz -C /usr/local/bin gitleaks

USER vscode

# uv : gestion de Python et des dépendances backend.
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/vscode/.local/bin:${PATH}"
