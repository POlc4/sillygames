# SillyGames — règles du dépôt

Projet d'apprentissage du déploiement conteneurisé. Le plan complet est dans `docs/plan.md`, les décisions dans `docs/adr/`. Lis-les avant toute modification structurelle.

## Stack et commandes

- Backend : Python 3.12, FastAPI, SQLAlchemy 2, Alembic, géré avec `uv`. Dans `backend/` : `uv run pytest`, `uv run ruff check .`, `uv run ruff format .`, `uv run mypy app`.
- Frontend : Next.js (App Router, TypeScript, Tailwind), React Three Fiber pour la 3D. Dans `frontend/` : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Base : PostgreSQL 16 via `docker compose up -d postgres`. URL de dev dans `.env` (modèle : `.env.example`).
- Stack complète en conteneurs : `docker compose up --build -d --wait` depuis le terminal WSL de l'hôte, pas depuis le devcontainer.
- Sans outil sur l'hôte (tout dans des conteneurs jetables) : `./scripts/backend-check.sh`, `./scripts/frontend-check.sh`, `./scripts/e2e.sh` (Playwright contre la stack compose).
- Hooks : `pre-commit run --all-files`.

## Conventions

- **Commits** : Conventional Commits en anglais (`feat:`, `fix:`, `docs:`, `ci:`, `chore:`, `refactor:`, `test:`). Scope optionnel : `feat(backend): ...`. Le CHANGELOG est généré par release-please, jamais édité à la main.
- **Langue** : code, commits, noms de fichiers en anglais. Documentation, ADR, README, commentaires d'explication en français.
- **Branches** : `main` protégée, une PR par intention, squash merge. Une PR ouverte par Claude passe la même CI et la même revue que les autres, jamais de merge automatique.
- **Tests, règle générale** : aucun comportement n'est livré sans test, dans tout le projet. Une PR qui ajoute ou modifie un comportement sans test correspondant est refusée. Trois niveaux, tous exécutés en CI :
  - *Unitaires* : logique pure sans I/O (moteurs de jeu, stratégies d'IA, sécurité, hooks et utilitaires front). Backend `pytest`, frontend `vitest`.
  - *Intégration* : chaque route API testée via `TestClient` contre un vrai Postgres migré par Alembic (`backend/tests/conftest.py`), jamais avec SQLite ni mocks de la base. Les appels réseau externes (OAuth, etc.) sont simulés. Côté front, composants testés avec Testing Library contre une API simulée (MSW).
  - *Bout en bout* : parcours utilisateur complets avec Playwright sur la stack `docker compose` (à partir de l'étape 5), exécutés en CI avant tout déploiement.
  - Seuils de couverture bloquants : backend 80 %, frontend 70 %. Les tests vérifient un comportement observable, pas une implémentation.
- **Migrations** : une migration Alembic mergée n'est jamais modifiée, on en crée une nouvelle.
- **Secrets** : jamais en dur ni commités. `.env` local, GitHub Secrets en CI, `.env` sur la VM. `gitleaks` tourne en pre-commit et en CI.
- **Docker** : images de prod minimales, non-root, multi-stage. L'image du devcontainer contient l'outillage et ne sert jamais de base aux images de prod. Toute action GitHub est épinglée par SHA de commit.
- **Logique de jeu** : hors des composants 3D. Les scènes reçoivent l'état et émettent des intentions (`onTake(n)`, `onPick(move)`).

## Documentation

- Toute décision d'architecture donne lieu à un ADR dans `docs/adr/NNNN-titre-kebab.md` (contexte, décision, conséquences), numéro suivant le dernier existant.
- Le README est un journal d'apprentissage : chaque étape du plan y ajoute les commandes utiles et les pièges rencontrés.
- `docs/runbook.md` décrit le provisionnement, le déploiement, le rollback et la restauration d'un backup. Le mettre à jour à chaque changement d'infra.

## Ce que Claude ne fait pas sans demander

- Modifier `deploy/`, les workflows de déploiement ou les secrets.
- Supprimer une migration, un ADR ou des données.
- Changer une décision documentée dans un ADR sans en écrire un nouveau qui la remplace.
