# SillyGames

Petit site de jeux (bâtonnets et pierre-feuille-ciseaux) contre une IA, construit pour apprendre le déploiement conteneurisé de bout en bout : Docker, docker compose, registre d'images, CI/CD, VM Linux, reverse proxy HTTPS. Règle d'or : tout est gratuit.

- Phase 1 : jeux jouables, IA aléatoire et IA « parfaite » pour les bâtonnets, résultats stockés en base, CI/CD et mise en ligne.
- Phase 2 : entraînement d'un modèle sur les parties enregistrées pour remplacer l'IA aléatoire.

Le plan complet est dans [docs/plan.md](docs/plan.md). Les décisions d'architecture sont dans [docs/adr](docs/adr).

## Stack

| Couche | Choix |
| --- | --- |
| Frontend | Next.js (App Router, TypeScript, Tailwind), scènes 3D avec React Three Fiber |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic |
| Base de données | PostgreSQL 16 |
| Conteneurs | Docker Engine, docker compose, images publiées sur GHCR |
| CI/CD | GitHub Actions |
| Production | VM Oracle Cloud Always Free, Caddy en reverse proxy HTTPS |

## Démarrer en local

Prérequis : Docker Engine dans WSL2 (ou Linux), VS Code avec l'extension Dev Containers. Aucun autre outil à installer sur la machine hôte.

```bash
git clone git@github.com:POlc4/sillygames.git ~/sillygames
cd ~/sillygames
cp .env.example .env
code .
```

Dans VS Code : « Reopen in Container ». Le devcontainer fournit Python, uv, Node, pre-commit et les linters, et démarre PostgreSQL à côté.

Depuis le terminal du devcontainer :

```bash
docker compose ps            # postgres doit être "healthy"
cd backend && uv run pytest  # à partir de l'étape 1 du plan
```

## Structure

```
backend/        API FastAPI, moteurs de jeu, migrations, tests
frontend/       Next.js
ml/             phase 2, entraînement des modèles
deploy/         compose de production, Caddyfile, script d'installation de la VM
docs/           plan, ADR, runbook
.devcontainer/  environnement de développement reproductible
.github/        workflows CI/CD, templates
```

## Journal d'apprentissage

Ce README évolue avec le projet. Chaque étape du plan ajoute ici les commandes utiles et les pièges rencontrés.

- Étape 0 : Docker Engine installé dans WSL2 avec systemd, sans Docker Desktop.
- Étape 0 bis : devcontainer basé sur le compose de dev.
- Étape 1 : moteurs de jeu purs (`backend/app/games`), IA aléatoire et IA parfaite, 100 tests. Sans Python sur l'hôte, la suite tourne dans un conteneur jetable :
  ```bash
  cd backend
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -e UV_CACHE_DIR=/tmp/uv-cache \
    -v "$PWD":/app -w /app ghcr.io/astral-sh/uv:python3.12-bookworm-slim \
    sh -c "uv sync && uv run ruff check . && uv run mypy && uv run pytest"
  ```
  Piège : sans `--user`, les fichiers créés par le conteneur (`.venv`, `uv.lock`) appartiennent à root sur l'hôte.
- CI : `.github/workflows/ci.yml` rejoue ruff, mypy et pytest à chaque push et PR, actions épinglées par SHA.
