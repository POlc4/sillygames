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
- Étape 2 : persistance et authentification. Tables `players`, `games`, `moves` (SQLAlchemy 2, migration Alembic `0001`), session en cookie JWT httpOnly, invité créé à la première visite et converti en compte à l'inscription sans changer d'identifiant. Les tests d'intégration migrent une base `sillygames_test` avec Alembic et la vident après chaque test. La commande unique pour tout vérifier (lint, types, migrations, tests) est `./scripts/backend-check.sh`, qui exige `docker compose up -d postgres`.
  - Piège : un dossier `alembic/` dans le projet fait classer la bibliothèque `alembic` comme code local par le tri d'imports de ruff. Réglé par `known-third-party` dans `pyproject.toml`.
  - Piège : PyJWT refuse à terme les secrets HS256 de moins de 32 octets. Générer le vrai secret avec `openssl rand -hex 32`.
  - En CI, Postgres tourne comme *service container* du job ; la migration est appliquée, comparée aux modèles (`alembic check`) puis annulée avant les tests.
- Étape 3 : parties et statistiques. `POST /api/games` crée une partie (type, stratégie d'IA, config validée), `POST /api/games/{id}/moves` applique le coup du joueur puis la réponse de l'IA dans la même requête, chaque tour est enregistré avec l'état avant et après. La partie n'a pas de colonne « état » : l'état courant est l'`state_after` du dernier coup, ou l'état initial dérivé de la config. `GET /api/stats/{me,global,leaderboard}` agrège les parties terminées par jeu et par stratégie.
  - Migration `0002` : `moves.player_move` devient nullable pour le coup d'ouverture de l'IA (tour 0) quand elle commence. Une migration mergée ne se modifie pas, on en ajoute une.
  - Piège : en mode souple, pydantic convertit le JSON `true` en entier 1 et `"2"` en 2. Les coups utilisent `StrictInt | StrictStr` pour refuser ces conversions. `Field(strict=True)` ne s'applique pas à une union.
  - Le générateur aléatoire est une dépendance FastAPI (`app/deps.py`) : les tests l'écrasent avec une graine fixe pour être rejouables.
  - Deux coups simultanés sur la même partie sont départagés par la contrainte unique `(game_id, turn)` : le second reçoit 409.
- Étape 4 : frontend Next.js 16 (App Router, TypeScript, Tailwind 4). Pages accueil, bâtonnets, pierre-feuille-ciseaux, stats, connexion, inscription. Le client API appelle `/api` en relatif ; en dev `next.config.ts` relaie vers le backend, en prod c'est Caddy. Session : au chargement, `/api/auth/me` puis `/api/auth/guest` si 401. Tests vitest + Testing Library + MSW (27 tests, 90 % de couverture, seuil 70 %). Sans Node sur l'hôte : `./scripts/frontend-check.sh`.
  - Piège : `create-next-app` installe `@types/node` 20 alors que vitest 5 exige la 22. Aligner sur la version de Node utilisée (22).
  - Piège : la règle ESLint `react-hooks/set-state-in-effect` (React 19) refuse qu'un effet appelle une fonction qui modifie l'état. Le chargement de session est une fonction pure, l'effet applique son résultat dans le `then`.
  - Le build utilise `output: "standalone"` pour produire une image Docker minimale à l'étape 5. Les polices Google ont été retirées : le build n'a plus besoin du réseau.
  - 3D : scènes React Three Fiber (`components/three/`), formes procédurales sans modèle externe, chargées par `next/dynamic` sans SSR et seulement si WebGL est disponible (`useWebGL`, basé sur `useSyncExternalStore` pour éviter tout mismatch d'hydratation). Les boutons 2D restent toujours présents : la scène est un second moyen d'entrée, pas le seul. Les retraits de bâtonnets sont animés en deux temps (joueur puis IA) par des timers, seules mises à jour d'état autorisées depuis un effet.
  - Les scènes ne se rendent pas dans jsdom : elles sont exclues de la couverture et testées en bout en bout. La disposition et la sélection des bâtonnets sont des fonctions pures testées à part.
- Étape 5 : conteneurisation. `backend/Dockerfile` (uv dans un stage builder, `python:3.12-slim` non-root, migrations Alembic dans `entrypoint.sh` puis `exec uvicorn`) et `frontend/Dockerfile` (build Next standalone, `node:22-slim` non-root). `docker compose up --build -d --wait` lance la stack complète avec healthchecks ; le frontend relaie `/api` vers `http://backend:8000`. Tests bout en bout Playwright dans `frontend/e2e`, lancés par `./scripts/e2e.sh` dans l'image officielle Playwright en réseau hôte. En CI, un job `images` lint les Dockerfiles avec hadolint, construit la stack, la sonde et joue les e2e.
  - Piège : `rewrites()` de `next.config.ts` est évalué au build, pas au démarrage. L'URL du backend est donc un `ARG` de build (`API_URL=http://backend:8000`), identique en compose local et en prod grâce au nom de service.
  - Piège : dans un test Playwright, `getByRole("alert")` attrape aussi l'annonceur de route de Next (`__next-route-announcer__`). Restreindre au `main`.
  - Tailles : backend 312 Mo, frontend 423 Mo. À réduire à l'étape sécurité (base alpine ou distroless, Trivy).
  - Piège : hadolint évolue. La 2.15 exige un UID numérique pour `USER` (DL3066) et la notation JSON pour `HEALTHCHECK CMD` (DL3025), silencieux en 2.12. Le pre-commit et la CI doivent utiliser la même version.
  - Piège : `LayoutProps` et les autres types globaux de Next 16 sont générés dans `.next/types` par `next typegen` ou `next build`. Sur un checkout frais, `tsc` seul échoue : le script `typecheck` lance `next typegen` d'abord.
- Étape 6 : sécurité et gouvernance. `security.yml` (gitleaks sur tout l'historique, CodeQL Python et JS/TS, pip-audit sur l'export uv, `npm audit`, Trivy sur les deux images avec SARIF dans l'onglet Security et échec sur CRITICAL corrigeable), Dependabot groupé, commitlint sur les PR, release-please (CHANGELOG et tags depuis les commits conventionnels), workflows Claude (revue de PR et mentions `@claude`) filtrés sur l'auteur et l'origine, templates de PR et d'issue, CODEOWNERS, CONTRIBUTING, runbook, skill `adr`.
  - Le `secrets` context n'est pas disponible dans le `if` d'un job : un premier step exporte la présence du secret en output, les suivants s'y conditionnent. Sans `CLAUDE_CODE_OAUTH_TOKEN`, les workflows Claude se sautent proprement au lieu d'échouer.
  - Piège : Docker Hub limite les pulls anonymes par IP (10 par heure depuis 2025) et les runners GitHub partagent leurs IP. Les images de base viennent de `mirror.gcr.io/library/…` (mêmes digests, miroir public de Google).
  - Piège : les logs d'un job GitHub Actions ne sont pas lisibles sans authentification, même sur un dépôt public. Le job `images` émet ses diagnostics d'échec en annotations (`::error::`), lisibles par l'API publique des check-runs, tronquées vers 1 000 caractères chacune.
- Étape 7 : production. `deploy/docker-compose.prod.yml` (Caddy seul exposé, images GHCR par tag `sha-<commit>`, Postgres avec volume, journaux bornés), `deploy/Caddyfile` (HTTPS automatique, HSTS, CSP, en-têtes de sécurité), `deploy/vm-setup.sh` (Docker Engine par le dépôt apt, iptables 80/443, swap, `.env` avec secrets aléatoires, cron de sauvegarde). `deploy.yml` construit et publie les images sur GHCR quand la CI est verte sur `main`, puis déploie en SSH et sonde le site ; `backup.yml` rapatrie chaque semaine un dump en artefact GitHub. Les deux se sautent tant que les secrets VM sont absents. Procédures complètes dans `docs/runbook.md`, vérification par le skill `deploy-check`.
  - `workflow_run` plutôt que `push` pour déclencher le déploiement : il n'y a pas de `needs` entre workflows, et on ne déploie que ce que la CI a validé (`head_sha` du run).
  - Sur les images Oracle, iptables refuse tout sauf SSH même si la Security List est ouverte : les deux doivent être configurés.
- Étape 2 bis : connexion externe (GitHub, Google, Microsoft, Facebook). Flux Authorization Code + PKCE écrit à la main avec httpx et PyJWT : `state` et `code_verifier` dans un cookie signé de 10 minutes, échange du code côté serveur, profil lu sur userinfo. Table `identities` (migration `0003`), règles de rattachement dans l'ADR 0007 (invité converti, compte lié, jamais de fusion par e-mail). Un fournisseur n'existe que si ses identifiants sont configurés ; le frontend affiche les boutons de `GET /api/auth/providers` et la page `/account` liste et délie les identités. Tests contre `httpx.MockTransport`, sans réseau.
  - Piège : GitHub ne renvoie l'e-mail dans `/user` que s'il est public ; il faut interroger `/user/emails` et prendre le principal vérifié.
  - Piège : `useSearchParams` de Next exige une frontière `Suspense`, sinon le prérendu statique de la page échoue.
- Phase 2 (ML) : stratégies « Apprenante » (`ml`) pour les deux jeux, inférence en Python pur à partir de JSON dans `backend/app/games/ai/models/`, donc aucune dépendance lourde dans l'image. Bâtonnets : table Q apprise par auto-jeu (`ml/train_sticks.py`), 100 % d'accord avec la stratégie parfaite après 30 000 épisodes. Pierre-feuille-ciseaux : n-grammes, prior global appris sur les parties exportées (`ml/export.py`, `ml/train_rps.py`) plus adaptation au joueur en cours de partie. `train.yml` ré-entraîne chaque semaine depuis la production et ouvre une PR avec les modèles. Démarche détaillée dans `ml/README.md`.
  - Piège : un test qui vérifie qu'une stratégie « inconnue » est refusée ne doit pas utiliser un nom qu'on finira par implémenter.
- Phase 3, palier 1 (PWA installable) : `app/manifest.ts` (servi sur `/manifest.webmanifest`), icônes PNG générées par un script Node sans dépendance, service worker `public/sw.js` écrit à la main (navigations réseau d'abord avec repli sur `/offline`, `/_next/static` cache d'abord, `/api` jamais mis en cache), enregistrement en production seulement avec bannière « Nouvelle version disponible ».
  - Piège : Next 16 construit avec Turbopack, donc le plugin webpack de Serwist ne s'applique pas. Un service worker vanille suffit pour ce palier ; le précache exhaustif des assets hachés viendra avec un outil de build dédié si le palier 2 (jeu hors ligne) l'exige.
  - Palier 2, première brique : moteurs de jeu et IA `random`/`perfect` portés en TypeScript (`frontend/lib/engines/`) avec les mêmes tests que le backend et un générateur aléatoire déterministe (mulberry32). Le jeu hors ligne proprement dit (IndexedDB, synchronisation, validation par rejeu côté serveur) reste à faire.
  - Palier 2, côté client : quand le réseau manque ou que le serveur ne répond pas, `useGame` bascule sur une partie locale (`lib/local-game.ts`, moteurs TypeScript, même forme que l'API), la met en file dans `localStorage` (`lib/offline.ts`) une fois terminée, et `lib/sync.ts` l'envoie à l'import au retour du réseau. Bandeau `OfflineStatus` avec le nombre de parties en attente et un bouton « Synchroniser ». Les parties refusées par le rejeu (422) sont abandonnées, les pannes conservent la file.
  - Palier 2, côté serveur : `POST /api/games/import` accepte une partie complète jouée hors ligne (coups joueur et IA), la rejoue coup par coup pour vérifier la légalité et la fin de partie, puis l'enregistre avec `offline: true` dans sa config. Les coups de l'IA ne sont pas reproduits (aléa côté client), seulement validés.
  - Piège e2e : saisir dans un champ contrôlé avant l'hydratation React fait perdre la saisie (React remet sa valeur d'état). Le helper `e2e/helpers.ts` attend `networkidle` et la disparition du « … » de la nav avant toute interaction, et le test vérifie la valeur saisie.
  - Piège : un service worker ne se met à jour que si le fichier change. `VERSION` dans `sw.js` doit changer à chaque déploiement qui touche les stratégies de cache, sinon l'ancien reste actif jusqu'à expiration.
  - Limitation de débit (slowapi) sur invité, inscription et connexion : 10 par minute et par IP, en-têtes `X-RateLimit-*`, 429 avec `Retry-After`. Piège : le décorateur s'exécute après la validation FastAPI, donc un corps invalide (422) n'est pas compté. Les tests désactivent le limiteur par défaut (IP unique) et le réactivent dans `test_ratelimit.py`.
