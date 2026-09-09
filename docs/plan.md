# Plan — SillyGames : site de jeux (bâtonnets + pierre-feuille-ciseaux) pour apprendre le déploiement conteneurisé

## Contexte

Objectif pédagogique : apprendre le déploiement conteneurisé de bout en bout (Docker, docker compose, registre d'images, CI/CD, VM Linux, reverse proxy HTTPS) sur un projet concret et 100 % gratuit.
Le support est un site de deux mini-jeux contre une IA. Chaque partie est enregistrée en base pour que la phase 2 puisse entraîner un modèle ML qui remplace l'IA aléatoire.

Décisions prises avec l'utilisateur :
- **Hébergement** : VM Oracle Cloud Always Free (Ubuntu), pilotée par `docker compose`. Carte bancaire requise à l'inscription mais jamais débitée.
- **Backend** : Python 3.12 / FastAPI (même langage pour l'API et le ML).
- **Frontend** : Next.js (React, préférence connue de l'utilisateur), TypeScript, Tailwind.
- **Base de données** : PostgreSQL dans un conteneur sur la VM (volume persistant).
- **Joueurs** : mode hybride. Invité par défaut (identifiant généré), avec possibilité de créer un compte (pseudo + mot de passe) qui **récupère l'historique de l'invité**.
- **Bâtonnets** : nombre initial paramétrable (par défaut 21, bornes 5–50), retrait fixé entre 1 et 3, celui qui prend le dernier perd.
  Le jeu est **résolu mathématiquement** : celui qui laisse à l'adversaire un nombre de bâtonnets ≡ 1 (mod 4) gagne à coup sûr en complétant ensuite chaque tour à 4 (l'adversaire prend 1, on prend 3, etc.). Avec 21 bâtonnets (21 % 4 = 1), le joueur qui joue **en second** gagne s'il ne se trompe jamais. Conséquences : le joueur choisit qui commence (ou tirage au sort), une IA « parfaite » existe comme niveau expert et sert de référence pour juger le ML.
- **Phase 1** : jeux + IA aléatoire + CI/CD + mise en ligne. **Phase 2** : ML sur les résultats.

État de la machine : Node 24 et Git présents. **Docker Desktop et Python absents** (à installer, étape 0).

---

## État d'avancement (2026-09-09)

| Étape | État | Notes |
| --- | --- | --- |
| 0, 0 bis | fait | Docker Engine WSL2, devcontainer, dépôt public, identité noreply |
| 1 | fait | moteurs de jeu, IA random et parfaite, 100 tests |
| 2 | fait | Postgres, Alembic 0001/0002, auth invité/compte, limitation de débit |
| 3 | fait | parties, coups, stats, classement |
| 4 | fait | Next.js, pages 2D, scènes 3D, 36 tests vitest |
| 5 | fait | Dockerfiles, compose complet, 4 scénarios Playwright |
| 6, 6 bis | fait | security.yml, Dependabot, release-please, commitlint, workflows Claude, gouvernance |
| 7, 8 | code prêt | deploy/, deploy.yml, backup.yml, runbook. **Bloqué par la VM** : inscription Oracle à retenter, sinon repli Render + Neon |
| 9 | à faire | vérification en prod une fois la VM en place |
| 2 bis (OAuth) | fait (code) | backend + frontend + tests ; il reste à enregistrer les applications chez chaque fournisseur (runbook) |
| Phase 2 (ML) | fait (code) | stratégies `ml` (n-grammes RPS, table Q bâtonnets), scripts `backend/ml/`, `train.yml` ; le prior RPS attend des parties réelles |
| Phase 3 (PWA) | paliers 1 et 2 faits | manifest, icônes, service worker vanille, page hors ligne, bannière de mise à jour ; moteurs TypeScript, parties locales mises en file (localStorage) et importées via `POST /api/games/import` avec rejeu serveur ; reste : palier 3 (push, optionnel) et vérification sur mobile réel |
| Phase 4 | à faire | optionnelle |

Réglages GitHub encore à faire par l'utilisateur : voir `docs/runbook.md` (approbation des workflows externes, secret scanning, ruleset, « Allow GitHub Actions to create PRs », secret `CLAUDE_CODE_OAUTH_TOKEN`).

## Architecture cible

```
Navigateur ──HTTPS──> Caddy (reverse proxy, certificats auto)
                        ├── /        → frontend  (Next.js standalone, port 3000)
                        └── /api/*   → backend   (FastAPI/uvicorn, port 8000)
                                          └── postgres:16 (volume docker)
```

Tout tourne sur la VM via un seul `docker-compose.prod.yml`. Les images sont construites par GitHub Actions, poussées sur GHCR (gratuit pour un dépôt public), puis la VM les récupère en `docker compose pull && up -d` déclenché en SSH par le workflow.

### Dépôt (monorepo public `sillygames`, à créer dans `C:\Users\johan\sillygames`)

```
sillygames/
├── backend/
│   ├── app/
│   │   ├── main.py              # création FastAPI, routers, CORS, /api/health
│   │   ├── config.py            # pydantic-settings (DATABASE_URL, JWT_SECRET, ...)
│   │   ├── db.py                # engine SQLAlchemy 2 + session
│   │   ├── models.py            # Player, Game, Move
│   │   ├── schemas.py           # pydantic I/O
│   │   ├── auth.py              # JWT cookie httpOnly, hash argon2, dépendance current_player
│   │   ├── games/
│   │   │   ├── base.py          # interface GameEngine + AIStrategy
│   │   │   ├── rps.py           # pierre-feuille-ciseaux (règles pures, testables)
│   │   │   ├── sticks.py        # bâtonnets (règles pures, testables)
│   │   │   └── ai/random.py     # RandomStrategy (phase 1) ; ai/ml.py en phase 2
│   │   └── routers/ auth.py, games.py, stats.py
│   ├── alembic/                 # migrations
│   ├── tests/                   # pytest (moteurs de jeu + API via httpx)
│   ├── pyproject.toml           # géré avec uv ; ruff pour le lint
│   ├── Dockerfile               # multi-stage, image python:3.12-slim, user non-root
│   └── entrypoint.sh            # alembic upgrade head puis uvicorn
├── frontend/
│   ├── app/                     # App Router : /, /rps, /sticks, /stats, /login, /register
│   ├── components/three/        # SticksScene, RpsScene (React Three Fiber), fallback 2D
│   ├── lib/api.ts               # fetch vers /api (même origine, cookies inclus)
│   ├── next.config.ts           # output: "standalone"
│   └── Dockerfile               # multi-stage node:22-alpine, user non-root
├── ml/                          # phase 2
├── deploy/
│   ├── docker-compose.prod.yml  # caddy + frontend + backend + postgres
│   ├── Caddyfile
│   ├── .env.example
│   └── vm-setup.sh              # install Docker, ouverture ports, dossier /opt/sillygames
├── docker-compose.yml           # DEV : postgres + backend (reload) + frontend (next dev)
├── .github/
│   ├── workflows/
│   │   ├── ci.yml               # lint, types, tests, coverage, hadolint, build images
│   │   ├── security.yml         # gitleaks, CodeQL, pip-audit/npm audit, Trivy
│   │   ├── deploy.yml           # push main : build + push GHCR + SSH deploy
│   │   ├── release-please.yml   # CHANGELOG + tags semver
│   │   ├── claude-review.yml    # revue automatique des PR par Claude
│   │   └── claude.yml           # réponses aux mentions @claude
│   ├── dependabot.yml, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/, CODEOWNERS
├── .devcontainer/               # devcontainer.json + Dockerfile de l'outillage (réutilise docker-compose.yml)
├── .claude/skills/              # adr, deploy-check, release-notes
├── docs/adr/, docs/runbook.md
├── CLAUDE.md, CONTRIBUTING.md, .pre-commit-config.yaml, .editorconfig
└── README.md                    # journal d'apprentissage : commandes, schéma, liens
```

### Modèle de données

- **players** : `id uuid`, `username unique null`, `password_hash null`, `is_guest bool`, `created_at`.
  Un invité est une ligne `is_guest=true`. L'inscription **convertit** la ligne invité courante (renseigne username/password, `is_guest=false`) : l'historique est conservé sans migration de données.
- **identities** (étape 2 bis) : `id`, `player_id`, `provider` (`google` | `microsoft` | `github` | `facebook`), `provider_subject` (identifiant stable chez le fournisseur), `email null`, `display_name null`, `created_at`, unique sur `(provider, provider_subject)`.
  Une connexion externe est une façon de plus de convertir l'invité courant, ou de retrouver le joueur lié. Un joueur peut avoir plusieurs identités et éventuellement aussi un mot de passe.
- **games** : `id`, `player_id`, `game_type` (`rps` | `sticks`), `ai_strategy` (`random` | `ml`), `config json` (ex. `{"sticks": 21}`), `status` (`in_progress` | `finished`), `result` (`win` | `loss` | `draw` | null), `started_at`, `finished_at`.
- **moves** : `id`, `game_id`, `turn`, `state_before json`, `player_move`, `ai_move`, `state_after json`, `created_at`.
  RPS : un move par manche (partie en 5 manches, `result` = vainqueur global). Bâtonnets : un move = un tour joueur + réponse IA.
  Ces séquences sont exactement la matière première du ML en phase 2.

### API (préfixe `/api`)

- `POST /auth/guest` → crée un invité, pose le cookie JWT. `POST /auth/register` (convertit l'invité courant ou crée), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- `GET /auth/oauth/{provider}/start` → redirection vers le fournisseur (state + PKCE en cookie signé). `GET /auth/oauth/{provider}/callback` → vérifie, crée ou retrouve l'identité, lie au joueur courant ou connecte le joueur lié, pose le cookie JWT, redirige vers le front. `GET /auth/identities`, `DELETE /auth/identities/{id}` (refusé s'il ne reste ni mot de passe ni autre identité).
- `POST /games` `{game_type, config}` → id + état initial. `POST /games/{id}/moves` `{move}` → coup IA, nouvel état, résultat éventuel. `GET /games/{id}`.
- `GET /stats/me`, `GET /stats/global` (taux de victoire par jeu et par stratégie IA), `GET /stats/leaderboard`.
- `GET /health` (utilisé par le healthcheck Docker et Caddy).

L'IA est derrière une interface `AIStrategy.choose(state, history) -> move` : en phase 2 on ajoute `MLStrategy` sans toucher aux routes. Le champ `ai_strategy` permet de comparer les deux dans les stats.

### Frontend

- Page d'accueil : choix du jeu, affichage du pseudo (ou « Invité »), bouton « Créer un compte pour garder mes stats ».
- `/sticks` : paramètres de la partie (nombre de bâtonnets, qui commence, difficulté aléatoire/expert), **scène 3D** du plateau, sélection des bâtonnets par clic, historique des coups. Après la partie, une explication optionnelle « pourquoi j'ai perdu » montre les positions 4k+1.
- `/rps` : **scène 3D** avec les trois symboles, animation de révélation, score de la manche, résultat sur 5 manches.
- `/stats` : mes stats + stats globales (tableau simple, graphique optionnel).

**Visualisation 3D** (Three.js via **React Three Fiber** + `@react-three/drei`, tout open source)
- Composants dans `frontend/components/three/`, chargés en `"use client"` et via `next/dynamic` avec `ssr: false` (WebGL n'existe pas côté serveur). Un fallback 2D minimal (boutons) reste affiché si WebGL est indisponible, ce qui garde le jeu accessible et testable.
- **Bâtonnets** : allumettes procédurales (cylindre + tête sphérique) posées sur une table, disposées en rangées de 5. Survol = surbrillance, clic = sélection de 1 à 3 bâtonnets contigus, bouton « Retirer » valide le coup. Retrait animé (chute/disparition), le coup de l'IA est rejoué avec la même animation, différée pour être lisible.
- **Pierre-feuille-ciseaux** : formes procédurales low-poly (pierre = icosaèdre bruité, feuille = plan légèrement courbé, ciseaux = deux lames en boîtes croisées), pas de modèle externe à télécharger. Le joueur clique un symbole, les deux choix tournent puis se révèlent face à face, effet visuel sur le vainqueur de la manche.
- Caméra orbitale légère (`OrbitControls` avec limites), lumières simples, ombres douces, palette cohérente avec le site. Fond uni derrière l'interface texte.
- Animations avec `@react-spring/three` ou interpolation dans `useFrame` ; pas de physique nécessaire.
- La logique de jeu reste hors des composants 3D : la scène reçoit l'état (bâtonnets restants, coups) et émet des intentions (`onTake(n)`, `onPick("rock")`). Les tests `vitest` portent sur la logique et les hooks, pas sur le rendu WebGL.
- Performance : `frameloop="demand"` quand rien ne bouge, textures inutiles, bundle 3D chargé uniquement sur les pages de jeu.
- Appels API en relatif (`/api/...`), `credentials: "include"`. En dev, `next.config.ts` fait un `rewrite` de `/api` vers `http://backend:8000`.

---

## Phase 1 — étapes d'implémentation

### Étape 0 — Prérequis poste de travail (à faire par l'utilisateur, gratuit)
1. **Docker Engine dans WSL2** (Ubuntu déjà installé), pas Docker Desktop : activer systemd dans `/etc/wsl.conf`, installer via le script officiel `get.docker.com`, ajouter l'utilisateur au groupe `docker`. Même outil que sur la VM. VS Code avec les extensions **WSL** et **Dev Containers**.
2. Cloner le dépôt **dans le système de fichiers WSL2** (ex. `~/sillygames` dans Ubuntu, ouvert via `code .`), pas dans `C:\`, pour des performances correctes sur `node_modules` et `next build`.
3. Python et uv sur Windows deviennent **optionnels** : ils sont fournis par le devcontainer (étape 0 bis). Node reste utile sur l'hôte mais n'est pas requis.
4. Compte GitHub, dépôt **public** `sillygames` (GHCR et minutes Actions illimités en public).
5. Compte Oracle Cloud (à lancer tôt : validation parfois longue). Créer une instance **Always Free** : d'abord tenter `VM.Standard.A1.Flex` (ARM, 2 OCPU / 12 Go en Always Free), sinon `VM.Standard.E2.1.Micro` (x86, 1 Go, ajouter 2 Go de swap). Ubuntu 24.04, clé SSH.
6. Nom de domaine gratuit : sous-domaine **DuckDNS** pointant sur l'IP publique de la VM (nécessaire pour le HTTPS automatique de Caddy).

### Étape 0 bis — Devcontainer (environnement de dev reproductible)
Premier contact concret avec les conteneurs, et il sert dès l'étape 1.
- `.devcontainer/devcontainer.json` avec `dockerComposeFile: ["../docker-compose.yml", "docker-compose.devcontainer.yml"]`, `service: dev`, `workspaceFolder: /workspace`. Le devcontainer **réutilise** le compose de dev (Postgres, backend, frontend) au lieu de le dupliquer.
- `.devcontainer/Dockerfile` (image `dev`, base `mcr.microsoft.com/devcontainers/base:ubuntu`) avec : Python 3.12 + uv, Node 22, `pre-commit`, `hadolint`, `gitleaks`, `docker` CLI (socket de l'hôte monté pour lancer `docker compose` depuis le conteneur), OCI CLI pour l'étape 7.
- `features` devcontainer plutôt que des installs manuelles quand elles existent (`python`, `node`, `docker-outside-of-docker`, `github-cli`).
- `postCreateCommand` : `uv sync` dans `backend/`, `npm ci` dans `frontend/`, `pre-commit install`. Extensions VS Code déclarées (Python, Ruff, ESLint, Prettier, Docker).
- Volumes nommés pour `node_modules` et `.venv` afin de ne pas les faire transiter par le bind mount.
- Le même fichier rend le dépôt ouvrable dans **GitHub Codespaces** (60 h/mois gratuites) : travail possible depuis n'importe quelle machine.
- Règle notée dans `CLAUDE.md` : l'image du devcontainer contient l'outillage, les Dockerfiles de `backend/` et `frontend/` restent minimaux et ne sont jamais dérivés de celle-ci.
- Vérification : « Reopen in Container », puis `uv run pytest` et `npm run lint` fonctionnent sans rien installer sur Windows ; `docker compose ps` depuis le terminal du conteneur voit Postgres.

### Étape 1 — Moteurs de jeu (backend, sans DB)
- `games/sticks.py` : état `{sticks, max_take: 3, current: "player"|"ai"}`, `apply(state, take)` avec validation (1–3, ≤ restant), détection de fin (celui qui prend le dernier perd). Paramètre initial validé 5–50. Option `first: "player"|"ai"|"random"` à la création de la partie, stockée dans `config`.
- `games/rps.py` : `resolve(player, ai)` → `win|loss|draw`, partie en 5 manches.
- `ai/random.py` : coup aléatoire valide (stratégie par défaut, phase 1).
- `ai/perfect.py` (bâtonnets uniquement, niveau « expert ») : prendre `(sticks - 1) % 4` si ce reste est entre 1 et 3, sinon position perdante → coup aléatoire (ou 1 pour faire durer). Propriété testée : avec `sticks % 4 == 1` et l'IA en second, elle gagne 100 % des parties contre n'importe quel adversaire.
- Difficulté choisie à la création de la partie (`ai_strategy` : `random` | `perfect`, puis `ml` en phase 2) et affichée dans les stats.
- Tests pytest unitaires sur les règles (cas limites : 1 bâtonnet restant, retrait invalide) et sur la stratégie parfaite (simulation contre un adversaire aléatoire et contre elle-même).

### Étape 2 — Persistance et auth
- SQLAlchemy 2 + Alembic, migration initiale des 3 tables.
- Auth : argon2 (`pwdlib`), JWT (`PyJWT`) dans cookie `httpOnly; SameSite=Lax; Secure` en prod. Une seule dépendance `current_player` sert invités et inscrits.
- Tests API avec `httpx.AsyncClient` contre un Postgres de test (service container en CI, compose en local).

### Étape 2 bis — Identités externes (OAuth 2 / OpenID Connect)
Objectif d'apprentissage : comprendre le flux Authorization Code + PKCE, la notion d'identité liée à un compte, et l'enregistrement d'une application chez chaque fournisseur. Tout est gratuit.

**Fournisseurs, dans l'ordre de mise en place**
1. **GitHub** : enregistrement en deux minutes, `http://localhost` accepté en dev, aucune validation. Sert à valider toute la mécanique.
2. **Google** : projet Google Cloud (sans carte), écran de consentement en mode « test » avec ta liste d'utilisateurs, puis publication pour ouvrir à tous (pas de vérification tant qu'on ne demande que `openid email profile`). OpenID Connect complet.
3. **Microsoft** : app registration Entra ID gratuite, type « comptes personnels et professionnels ». OpenID Connect via `login.microsoftonline.com/common`.
4. **Facebook** : app Meta for Developers gratuite, mais l'app reste en « mode développement » (seuls les testeurs déclarés peuvent se connecter) tant qu'elle n'a pas passé la revue Meta, qui exige une URL de politique de confidentialité et parfois une vérification d'entreprise. À garder en dernier, en acceptant qu'il reste peut-être limité aux testeurs.

**Implémentation backend**
- Bibliothèque **Authlib** (client OAuth/OIDC pour Starlette/FastAPI), configuration par fournisseur dans `app/auth/providers.py` (URL de découverte OIDC pour Google et Microsoft, endpoints explicites pour GitHub et Facebook). Secrets `OAUTH_<PROVIDER>_CLIENT_ID` / `_CLIENT_SECRET` en variables d'environnement, fournisseur désactivé si absents.
- Flux : `state` anti-CSRF et PKCE obligatoires, `nonce` pour OIDC, vérification de la signature de l'`id_token` avec les JWKS du fournisseur. Cookie temporaire signé pour porter `state`/`code_verifier` entre le départ et le retour.
- Règle de liaison : si le visiteur est un invité, l'identité est attachée à son joueur (conversion, historique conservé, comme l'inscription par mot de passe). Si l'identité existe déjà pour un autre joueur, on connecte ce joueur. Un e-mail identique chez deux fournisseurs ne fusionne **pas** automatiquement les comptes (les e-mails ne sont pas tous vérifiés, Facebook peut ne pas en fournir) : la fusion se fait explicitement depuis le compte connecté via « lier un fournisseur ».
- Page compte côté front : liste des identités liées, boutons « lier » / « délier », impossibilité de délier la dernière méthode de connexion.
- URLs de retour : `http://localhost:3000/api/auth/oauth/<provider>/callback` en dev, `https://<domaine>/api/auth/oauth/<provider>/callback` en prod, à déclarer chez chaque fournisseur. Le runbook liste les quatre consoles.
- Tests : le fournisseur est simulé (serveur OIDC factice avec `respx` ou un `httpx.MockTransport`) pour tester callback, liaison, connexion existante, `state` invalide, `id_token` mal signé. Aucun appel réseau réel en CI.
- ADR 0005 à écrire : identités externes multiples par joueur, pas de fusion automatique par e-mail.

### Étape 3 — Routes jeux et stats
- Création de partie, jeu tour par tour, clôture avec `result`, stats agrégées en SQL.

### Étape 4 — Frontend Next.js
- `create-next-app` (TS, Tailwind, App Router, ESLint). Pages listées ci-dessus, client léger `lib/api.ts`, création automatique de l'invité au premier chargement.
- D'abord les pages avec le fallback 2D (jeu jouable de bout en bout), puis ajout de `three`, `@react-three/fiber`, `@react-three/drei` et des scènes 3D `SticksScene` et `RpsScene` par-dessus la même logique.
- Vérifier le build standalone avec les dépendances 3D (taille du bundle, chargement dynamique effectif) avant l'étape Docker.

### Étape 5 — Conteneurisation locale
- `backend/Dockerfile` multi-stage (uv → image slim, non-root, `HEALTHCHECK` sur `/api/health`).
- `frontend/Dockerfile` multi-stage (`next build` standalone → `node:22-alpine`, non-root).
- `docker-compose.yml` dev avec volumes montés et hot-reload ; `.env.example`. C'est le même fichier que celui chargé par le devcontainer (étape 0 bis), donc Postgres est déjà en place à ce stade ; on y ajoute les services `backend` et `frontend` construits depuis leurs Dockerfiles.
- Vérification : `docker compose up --build`, jouer une partie, vérifier les lignes en base (`docker compose exec postgres psql`).

### Étape 6 — CI qualité + sécurité (`ci.yml` + `security.yml`)
Tout est gratuit sur un dépôt public. Jobs parallèles, la PR est bloquée si l'un échoue (branch protection sur `main`).

**Qualité**
- `backend` : `ruff check` + `ruff format --check`, `mypy` (mode strict progressif), `pytest --cov` avec seuil minimal (80 %) et service Postgres.
- `frontend` : `eslint`, `prettier --check`, `tsc --noEmit`, `next build`, tests `vitest` sur les composants clés.
- `docker` : build des deux images sans push (cache GHA) + **hadolint** sur les Dockerfiles.
- `commitlint` : messages au format Conventional Commits (`feat:`, `fix:`, `ci:`, `docs:`...), ce qui alimente le CHANGELOG automatique.
- Hooks locaux `pre-commit` (ruff, prettier, hadolint, gitleaks) pour attraper les erreurs avant le push.

**Sécurité** (`security.yml`, sur PR + planifié chaque semaine)
- **gitleaks** : détection de secrets commités (+ hook pre-commit).
- **CodeQL** (GitHub natif) : analyse statique Python + JavaScript.
- **Dépendances** : `pip-audit` (backend), `npm audit --audit-level=high` (frontend), **Dependabot** (`.github/dependabot.yml`) pour pip, npm, Docker et GitHub Actions avec regroupement des mises à jour mineures.
- **Trivy** : scan des images Docker construites (vulnérabilités OS + libs), échec si `CRITICAL`, résultats envoyés dans l'onglet Security (SARIF).
- **Actions épinglées** par SHA de commit (pas de `@v4` flottant) ; `permissions:` minimales par workflow.
- Bonnes pratiques images : non-root, `slim`/`alpine`, pas de secret dans les layers, `.dockerignore`.
- En prod : en-têtes de sécurité dans Caddy (HSTS, CSP de base, `X-Frame-Options`), rate-limiting sur `/api/auth/*` (`slowapi`), CORS restreint au domaine.

**Livraison**
- **release-please** : à chaque merge sur `main`, ouvre/maintient une PR de release qui génère `CHANGELOG.md` et le tag `vX.Y.Z` à partir des commits conventionnels. Les images GHCR sont taguées `sha`, `latest` et `vX.Y.Z`.

### Étape 6 bis — Gouvernance du dépôt et intégration de Claude
Objectif : que les règles du projet soient écrites une fois, lues par les humains **et** par Claude, et appliquées automatiquement.

**Conventions codifiées dans le dépôt**
- `CLAUDE.md` à la racine : stack, commandes (`uv run pytest`, `npm run lint`, `docker compose up`), structure des dossiers, conventions (Conventional Commits, une PR = une intention, tests obligatoires pour tout moteur de jeu, migrations Alembic jamais éditées après merge, secrets jamais en dur), règles de documentation (README = runbook, ADR pour toute décision d'architecture, CHANGELOG généré et non édité à la main). Des `CLAUDE.md` courts dans `backend/` et `frontend/` pour les spécificités locales.
- `docs/adr/` : Architecture Decision Records numérotés (`0001-oracle-vm-docker-compose.md`, `0002-fastapi-backend.md`, `0003-guest-then-register.md`...). Les décisions déjà prises dans ce plan deviennent les premiers ADR.
- `docs/runbook.md` : provisionnement VM, déploiement, rollback (`docker compose up -d` avec un tag `sha` précédent), restauration d'un backup, rotation des secrets.
- `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` (checklist : tests, doc, ADR si décision, migration), `.github/ISSUE_TEMPLATE/`, `CODEOWNERS`, `.editorconfig`.
- Branch protection sur `main` : PR obligatoire, CI verte requise, historique linéaire (squash merge), signature des commits optionnelle.

**Claude dans le workflow GitHub**
- Installation de l'app GitHub Claude via `/install-github-app` depuis Claude Code (utilise l'abonnement Claude existant via `CLAUDE_CODE_OAUTH_TOKEN`, pas de coût supplémentaire ; alternative `ANTHROPIC_API_KEY` si préféré).
- `.github/workflows/claude-review.yml` : revue automatique de chaque PR (lit `CLAUDE.md`, vérifie conventions, tests manquants, sécurité, doc à mettre à jour) et publie des commentaires. Permissions minimales (`pull-requests: write`, `contents: read`).
- `.github/workflows/claude.yml` : Claude répond aux mentions `@claude` dans les issues/PR (ex. « @claude ajoute un ADR pour ce choix », « @claude corrige le lint ») et pousse un commit ou ouvre une PR.
- Skills locaux dans `.claude/skills/` pour les tâches récurrentes : `adr` (créer un ADR au bon format), `deploy-check` (vérifier l'état de la VM et des conteneurs), `release-notes`. Ils sont versionnés donc partagés avec l'app GitHub.
- Règle inscrite dans `CLAUDE.md` : toute PR ouverte par Claude passe la même CI et la même revue que les autres ; jamais de merge automatique.

### Étape 7 — Préparation de la VM (`deploy/vm-setup.sh` + README runbook)
- Installer Docker Engine + plugin compose, ajouter l'utilisateur au groupe docker.
- Ouvrir 80/443 : **dans la security list du VCN Oracle ET dans iptables de l'image** (piège classique Oracle).
- Créer `/opt/sillygames` avec `docker-compose.prod.yml`, `Caddyfile`, `.env` (secrets générés : `POSTGRES_PASSWORD`, `JWT_SECRET`, `DOMAIN`).
- `Caddyfile` : `{$DOMAIN}` → `handle /api/* { reverse_proxy backend:8000 }`, `handle { reverse_proxy frontend:3000 }`.
- Compose prod : `restart: unless-stopped`, volumes `pgdata` et `caddy_data`, healthchecks, `depends_on: condition: service_healthy`, pas de port exposé sauf Caddy.
- Sauvegarde : cron quotidien `pg_dump` vers `/opt/sillygames/backups` (rotation 7 jours).

### Étape 8 — CD (`deploy.yml`)
- Sur push `main` : login GHCR (`GITHUB_TOKEN`), build + push `ghcr.io/<user>/sillygames-backend` et `-frontend` tagués `sha` et `latest`. Plateforme selon la VM : `linux/arm64` sur runner `ubuntu-24.04-arm` (gratuit en dépôt public) ou `linux/amd64`.
- Job `deploy` : `appleboy/ssh-action` avec secrets `VM_HOST`, `VM_USER`, `VM_SSH_KEY` → `cd /opt/sillygames && docker compose pull && docker compose up -d && docker image prune -f`. Les migrations Alembic s'exécutent dans `entrypoint.sh` du backend au démarrage.
- Environnement GitHub `production` avec les secrets ; badge dans le README.

### Étape 9 — Vérification de bout en bout
- `https://<sous-domaine>.duckdns.org` sert le site, `/api/health` répond.
- Partie jouée en prod → lignes visibles via `psql` sur la VM.
- Modifier un texte, push sur `main`, observer CI verte puis mise à jour du site sans intervention.
- Redémarrer la VM : les conteneurs reviennent seuls et les données persistent.

---

## Phase 2 — ML (cadrage, à détailler quand la phase 1 est en prod)

- **Pierre-feuille-ciseaux** (cible principale, les humains ont des patterns) : dataset = séquences de coups par joueur depuis `moves`. Baseline n-gramme (fréquence du coup suivant sachant les k derniers), puis modèle scikit-learn (features : k derniers coups, dernier résultat, taux par coup). L'IA joue le contre du coup prédit. Évaluation hors-ligne par rejeu contre l'historique vs le random.
- **Bâtonnets** : le jeu étant résolu, l'intérêt est pédagogique : Q-learning tabulaire (état = bâtonnets restants, action = 1–3) entraîné par auto-jeu et sur les parties humaines enregistrées. On mesure à quelle vitesse l'agent redécouvre la règle « laisser 4k+1 » en comparant sa table Q à la stratégie `perfect`, et on affiche son taux de victoire face à `random` et `perfect`. Second axe : exploiter les erreurs humaines dans les positions perdantes (quel coup pousse le plus souvent le joueur à se tromper), ce que la stratégie parfaite ignore.
- **Intégration** : `ml/train.py` produit un artefact `joblib` ; `MLStrategy` le charge au démarrage. Les nouvelles parties sont réparties aléatoirement entre `random` et `ml` (A/B) pour mesurer le gain sur `/stats/global`.
- **Pipeline** : workflow `train.yml` planifié qui récupère un export (endpoint admin protégé par token ou `pg_dump` récupéré en SSH), entraîne, publie le modèle en artefact/release, puis redéploie.

---

## Phase 3 — PWA (Progressive Web App)

Objectif d'apprentissage : manifest, service worker, stratégies de cache, mode hors ligne, installation sur mobile et bureau, audit Lighthouse. Se fait après la mise en ligne, car un service worker exige HTTPS et se teste réellement en prod.

**Palier 1 : installable**
- `app/manifest.ts` dans Next.js (nom, couleurs, `display: standalone`, `start_url`, icônes 192/512 px maskable générées depuis un SVG). Balises `theme-color` et `apple-touch-icon`.
- Service worker avec **Serwist** (successeur maintenu de next-pwa, gratuit) : précache de l'app shell (pages, JS, CSS, icônes), stratégie `NetworkFirst` sur `/api/*`, `StaleWhileRevalidate` sur les assets.
- Page hors ligne dédiée servie par le service worker quand le réseau manque.
- Vérification : bannière « Installer » sur Chrome bureau et Android, application ouverte en fenêtre autonome, audit **Lighthouse CI** ajouté au workflow (score PWA et performance publiés en commentaire de PR, seuil bloquant sur les régressions).

**Palier 2 : jouer hors ligne**
- Les moteurs de jeu sont côté serveur ; pour jouer sans réseau, portage des deux moteurs et de l'IA `random`/`perfect` en TypeScript dans `frontend/lib/engines/`, avec les mêmes tests que le backend (vitest) pour garantir des règles identiques.
- Parties hors ligne stockées en IndexedDB, puis synchronisées : `POST /api/games/import` accepte une partie complète (coups + résultat) et la rejoue côté serveur pour la valider avant de l'enregistrer. Le serveur reste la source de vérité pour les stats et le ML.
- Indicateur d'état réseau et file d'attente de synchronisation visibles dans l'interface. Background Sync là où le navigateur le supporte, repli sur synchronisation à l'ouverture.

**Palier 3 : notifications push (optionnel)**
- Clés VAPID générées une fois (gratuit), abonnements stockés en base, envoi par le backend avec `pywebpush`. Cas d'usage : « ton adversaire IA s'est amélioré » après un entraînement ML, ou rappel hebdomadaire. À n'activer qu'avec opt-in explicite.

**Points d'attention PWA**
- La 3D et le service worker cohabitent bien, mais le bundle Three.js doit être dans le précache pour que les pages de jeu fonctionnent hors ligne.
- Un service worker mal versionné sert une vieille version : stratégie de mise à jour explicite (bouton « Nouvelle version disponible ») et test de mise à jour dans le runbook.
- Le cookie JWT est envoyé automatiquement par le navigateur, y compris depuis l'app installée ; rien à changer côté auth. Pour la connexion OAuth depuis l'app installée, la redirection revient dans la fenêtre autonome : à tester sur Android et iOS.
- iOS : installation via « Ajouter à l'écran d'accueil » uniquement, pas de bannière, Background Sync et push limités. À documenter plutôt qu'à contourner.

## Phase 4 (optionnelle) — Rust dans la stack

À décider une fois la phase 1 en production. Rust n'apporte rien au cœur du projet (déploiement, ML en Python) mais offre deux exercices de conteneurisation et d'architecture qu'aucun autre composant ne couvre.

**Palier 1 : un service compilé dans le compose**
- Petit service Rust (Axum) à périmètre volontairement réduit, par exemple le calcul du classement et des agrégats de stats à partir de Postgres (`sqlx`), exposé sous `/api/stats/*` derrière Caddy et consommé par le backend ou le front.
- Dockerfile multi-stage : compilation dans `rust:1-slim`, binaire statique (`musl`) copié dans une image `scratch` ou `gcr.io/distroless/static`. Objectif mesurable : image de quelques Mo, sans shell ni paquet, zéro finding Trivy, démarrage en millisecondes. Comparaison documentée avec les images Python et Node du projet.
- Cache de compilation en CI (`Swatinem/rust-cache`), `cargo clippy` et `cargo test` dans `ci.yml`, tests d'intégration contre le service Postgres comme pour le backend.

**Palier 2 : les moteurs de jeu en WebAssembly**
- Crate `engines` avec les règles des bâtonnets et de pierre-feuille-ciseaux, plus les stratégies `random` et `perfect`, avec les mêmes tests que la version Python.
- Compilation en WASM avec `wasm-pack` pour le frontend : remplace le portage TypeScript prévu au palier 2 de la phase 3, donc une seule implémentation des règles pour le jeu hors ligne au lieu de deux à maintenir en parallèle.
- Mesures à documenter : taille du module, temps de chargement, différence de performance avec le TypeScript. Le backend Python reste la source de vérité pour valider les parties importées.

**Critère de décision** : ne lancer cette phase que si les phases 1 à 3 sont stables et que l'envie d'apprendre Rust est réelle ; sinon, le portage TypeScript de la phase 3 suffit.

## Points d'attention

### Oracle Cloud Always Free : ce qui peut bloquer et comment s'en sortir

**Ce qui est réellement gratuit (vérifié sur la doc Oracle, sept. 2026)**
- 2 VM `VM.Standard.E2.1.Micro` (x86 AMD, 1/8 OCPU, 1 Go RAM chacune) : quasi toujours disponibles.
- ARM `VM.Standard.A1.Flex` : 1 500 heures OCPU + 9 000 Go·h par mois, soit **2 OCPU / 12 Go** en continu (Oracle a réduit l'ancien 4 OCPU / 24 Go). Très demandé.
- 200 Go de stockage bloc au total, 10 To de trafic sortant par mois. Carte bancaire jamais débitée sauf passage volontaire en Pay As You Go.

**Risque 1 : inscription refusée ou bloquée**
- Symptômes fréquents : « transaction failed » ou erreur sans explication à l'étape carte, compte en « en attente de validation » pendant des heures ou des jours.
- Causes habituelles : carte prépayée ou virtuelle (Revolut, Lydia, cartes virtuelles de banque) refusées ; nom/adresse saisis différents de ceux de la banque ; VPN ou navigateur avec bloqueurs ; plusieurs tentatives rapprochées.
- Parade : carte bancaire classique, coordonnées identiques à la banque, sans VPN, une seule tentative par jour. Une empreinte de vérification d'environ 1 € apparaît puis disparaît. Si le blocage persiste, ouvrir un ticket via le chat support Oracle (« account activation »), ça se débloque généralement en 24–72 h.

**Risque 2 : « Out of host capacity » à la création de la VM ARM**
- La région d'origine (home region) est **choisie à l'inscription et définitive**. C'est là que les ressources Always Free sont créées. Les régions européennes populaires (Francfort, Amsterdam, Paris, Marseille) sont souvent saturées pour l'A1.
- Parades dans l'ordre :
  1. À l'inscription, choisir une région avec 3 domaines de disponibilité (moins de saturation) et vérifier l'état de capacité au moment de créer la VM.
  2. Retenter en changeant de domaine de disponibilité, puis retenter à des heures creuses. Beaucoup de gens réussissent après quelques jours.
  3. Automatiser la tentative : petit script `oci compute instance launch` en boucle (OCI CLI, gratuit) toutes les 10 minutes jusqu'au succès ; c'est un exercice d'IaC utile pour le projet.
  4. Passer le compte en **Pay As You Go** : les quotas Always Free restent gratuits mais l'allocation de capacité devient prioritaire. Contrepartie : tout dépassement serait facturé, donc poser une **alerte de budget à 1 €** et ne créer que des ressources marquées « Always Free ».
  5. Se rabattre sur `E2.1.Micro` (x86, 1 Go) : suffisant pour ce projet avec 2 Go de swap et les images construites sur GitHub (jamais sur la VM). Le workflow de déploiement a une variable `PLATFORM` (`linux/amd64` ou `linux/arm64`) pour basculer sans changer le reste.

**Risque 3 : VM récupérée pour inactivité**
- Sur un compte Always Free (non PAYG), Oracle peut supprimer une VM si sur 7 jours consécutifs : CPU (95e centile) < 20 %, réseau < 20 %, et mémoire < 20 % (A1 seulement).
- Parade : un site de démo faiblement visité est exactement dans ce cas. Prévoir un `cron` de « keep-alive » léger (ex. job qui génère un peu de CPU quelques minutes par jour, ou un moniteur externe gratuit type UptimeRobot qui ping le site toutes les 5 min), et surtout un **backup automatique** (`pg_dump` quotidien) copié hors VM (artefact GitHub via workflow planifié en SSH, ou stockage objet Oracle inclus dans le free tier) pour pouvoir tout recréer.

**Plan de repli si Oracle est inaccessible sous 1 semaine**
- Render (service web Docker gratuit, sans carte, mise en veille après 15 min) + Neon (Postgres serverless gratuit, sans carte). Même dépôt, mêmes Dockerfiles, même CI ; seul le job `deploy` change (déclenchement d'un deploy hook Render au lieu du SSH). Le `docker-compose.prod.yml` et Caddy restent dans le dépôt pour le jour où la VM devient disponible.
- Sur E2.1.Micro (1 Go), ne jamais builder sur la VM : les images viennent toujours de GHCR.
- Secrets uniquement dans `.env` sur la VM et dans GitHub Secrets ; `.env` dans `.gitignore`.
- Écrire le README au fil de l'eau : c'est le livrable d'apprentissage.
