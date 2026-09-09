# Runbook

Procédures d'exploitation. Mis à jour à chaque changement d'infra ou de CI.

## Environnements

| Environnement | Où | Comment |
| --- | --- | --- |
| Dev | devcontainer | Postgres via compose, backend et frontend en hot-reload |
| Intégration locale | WSL2 hôte | `docker compose up --build -d --wait`, mêmes images qu'en prod |
| CI | GitHub Actions | workflows `ci.yml`, `security.yml`, `commitlint.yml`, `release-please.yml` |
| Production | VM Oracle Always Free | à venir, étape 7 du plan |

## Réglages GitHub à faire une fois

- Settings > Actions > General : « Require approval for all external contributors » ; workflow permissions en lecture seule ; cocher « Allow GitHub Actions to create and approve pull requests » (nécessaire à release-please et aux PR ouvertes par Claude).
- Settings > Code security : Dependabot alerts et security updates, secret scanning, push protection, private vulnerability reporting.
- Settings > Rules > Rulesets sur `main` : voir la section « Protéger main » ci-dessous.
- Secrets (Settings > Secrets and variables > Actions) :
  - `CLAUDE_CODE_OAUTH_TOKEN` : posé par `claude /install-github-app` depuis le terminal, ou à la main. Sans lui, les workflows Claude se sautent proprement.
  - `VM_HOST`, `VM_USER`, `VM_SSH_KEY` : étape 7, dans l'environnement `production`.

## Protéger main : aucune modification sans PR, revue et CI

Les rulesets sont gratuits sur un dépôt public (sur un dépôt privé, ils exigent un plan payant). Settings > Rules > Rulesets > New branch ruleset :

| Réglage | Valeur |
| --- | --- |
| Name / Enforcement | `main` / Active |
| Target branches | Include default branch |
| Bypass list | **vide** (le propriétaire ne peut pas contourner non plus) |
| Restrict deletions | coché |
| Require linear history | coché (squash merge uniquement) |
| Require a pull request before merging | coché ; Required approvals : `0` en solo (on ne peut pas approuver sa propre PR ; passer à `1` dès qu'un second relecteur existe) ; Dismiss stale approvals ; Require conversation resolution |
| Require status checks to pass | coché, « Require branches to be up to date » ; checks : `Backend (ruff, mypy, pytest)`, `Frontend (prettier, eslint, tsc, vitest, build)`, `Images (hadolint, compose build, e2e Playwright)`, `Secrets (gitleaks)`, `Images (Trivy) (backend)`, `Images (Trivy) (frontend)`, `commitlint` |
| Block force pushes | coché |

Effets : plus aucun push direct sur `main`, ni depuis un poste, ni par Claude. La « revue » en solo est la revue automatique de Claude (workflow `claude-review.yml`) plus ta relecture avant de cliquer « Squash and merge ».

Nouveau cycle de travail, pour toi comme pour Claude :

```bash
git switch -c feat/ma-modification main
# ... commits conventionnels ...
git push -u origin feat/ma-modification   # git affiche le lien « Create a pull request »
```

Ouvrir la PR (lien affiché, ou `gh pr create` si `gh` est authentifié), attendre la CI et la revue, merger en squash depuis GitHub. Claude n'ayant pas d'authentification GitHub, c'est toi qui merges. Les PR de Dependabot et de release-please suivent le même chemin.

## Vérifier avant de merger

```bash
./scripts/backend-check.sh     # ruff, mypy, alembic, pytest contre Postgres
./scripts/frontend-check.sh    # prettier, eslint, tsc, vitest + couverture, build
./scripts/e2e.sh               # stack compose + Playwright
docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:latest -no-color   # workflows GitHub
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest \
  image --severity CRITICAL,HIGH --ignore-unfixed sillygames-frontend:local           # comme la CI
```

Lire l'état de la CI sans se connecter : l'API publique de GitHub (60 requêtes par heure et par IP, ne pas boucler) donne les runs, les jobs et les annotations ; les logs complets exigent une authentification (`gh auth login` puis `gh run view --log`).

## Sécurité en CI

| Contrôle | Outil | Bloquant |
| --- | --- | --- |
| Secrets commités | gitleaks (historique complet) | oui |
| Analyse statique | CodeQL Python et JavaScript/TypeScript | alertes dans l'onglet Security |
| Dépendances Python | pip-audit sur `uv export` | oui |
| Dépendances npm | `npm audit --audit-level=high --omit=dev` | oui |
| Images Docker | Trivy, SARIF vers Security, échec sur CRITICAL corrigeable | oui |
| Dockerfiles | hadolint (seuil info) | oui |
| Mises à jour | Dependabot hebdomadaire, groupées mineures/patch | PR automatiques |

## Releases

release-please ouvre et maintient une PR « chore(main): release X.Y.Z » à partir des commits `feat`/`fix`. La merger crée le tag `vX.Y.Z`, la release GitHub et met à jour `CHANGELOG.md`, `version.txt`, `backend/pyproject.toml` et `frontend/package.json`. Ne jamais éditer le CHANGELOG à la main.

## Incidents

- CI rouge sur `main` : corriger par un commit `fix(ci): ...` ou revert, jamais en désactivant un contrôle.
- Alerte Trivy CRITICAL : mettre à jour l'image de base ou la dépendance ; si aucun correctif n'existe (`ignore-unfixed` déjà actif), documenter l'exception dans une issue.
- Secret exposé : le révoquer d'abord (GitHub, Oracle, fournisseur OAuth), puis réécrire l'historique si nécessaire, puis remettre un nouveau secret.

## Provisionnement de la VM (une fois)

1. **Oracle Cloud** : Compute > Instances > Create. Nom `sillygames`, shape Always Free (`VM.Standard.A1.Flex` 2 OCPU / 12 Go si disponible, sinon `VM.Standard.E2.1.Micro`), image Ubuntu 24.04, clé SSH publique de `~/.ssh/oracle_sillygames.pub`. Noter l'IP publique.
2. **Réseau** : Networking > Virtual Cloud Networks > le VCN > Security Lists > Default > Add Ingress Rules : source `0.0.0.0/0`, TCP 80 ; TCP 443 ; UDP 443. Sans ça, rien ne passe même si iptables est ouvert.
3. **DNS** : sur duckdns.org, créer le sous-domaine et y mettre l'IP publique. Vérifier : `dig +short <sous-domaine>.duckdns.org`.
4. **Installation** :
   ```bash
   ssh -i ~/.ssh/oracle_sillygames ubuntu@<IP>
   curl -fsSL https://raw.githubusercontent.com/POlc4/sillygames/main/deploy/vm-setup.sh -o vm-setup.sh
   bash vm-setup.sh          # Docker, iptables 80/443, swap, /opt/sillygames, .env avec secrets, cron de sauvegarde
   exit && ssh ...           # pour prendre le groupe docker
   nano /opt/sillygames/.env # DOMAIN=<sous-domaine>.duckdns.org
   ```
5. **Images** : la première exécution de `deploy.yml` crée les paquets GHCR en privé. Les passer en public : github.com/POlc4?tab=packages > paquet > Package settings > Change visibility. Alternative sans exposition : sur la VM, `docker login ghcr.io` avec un PAT `read:packages`.
6. **Premier démarrage** : `cd /opt/sillygames && docker compose pull && docker compose up -d --wait && docker compose ps`. Caddy obtient le certificat en quelques secondes ; vérifier `docker compose logs caddy`.
7. **Secrets GitHub** (environnement `production`) : `VM_HOST` (IP), `VM_USER` (`ubuntu`), `VM_SSH_KEY` (clé privée dédiée au déploiement, générée avec `ssh-keygen -t ed25519 -f deploy_key`, clé publique ajoutée dans `~/.ssh/authorized_keys` de la VM). Variable de dépôt `DOMAIN` (pour le smoke test) et `DEPLOY_PLATFORM` (`linux/arm64` si VM A1).

## Déploiement continu

`deploy.yml` s'exécute quand `CI` réussit sur `main` : construit les deux images (`ghcr.io/polc4/sillygames-{backend,frontend}` taguées `sha-<commit>` et `latest`), puis en SSH sur la VM : `IMAGE_TAG` mis à jour dans `.env`, `docker compose pull`, `up -d --wait`, `image prune`, puis smoke test HTTPS. Un tag `vX.Y.Z` (release-please) publie aussi les images avec ce tag.

Vérification après déploiement : skill `deploy-check`, ou à la main `curl https://<domaine>/api/health` et `docker compose ps` sur la VM.

## Rollback

Sur la VM, revenir à une image précédente (les tags `sha-` restent sur GHCR) :

```bash
cd /opt/sillygames
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=sha-<commit précédent>|" .env
docker compose pull --quiet && docker compose up -d --wait && docker compose ps
```

Les migrations Alembic ne sont pas annulées automatiquement : si la version précédente n'est pas compatible avec le schéma courant, exécuter `docker compose exec backend alembic downgrade <révision>` avant, ou restaurer une sauvegarde.

## Sauvegardes et restauration

- Quotidienne sur la VM : cron `03:00`, `backup.sh`, fichiers `backups/sillygames-<date>.sql.gz`, rotation 7 jours, lien `latest.sql.gz`.
- Hebdomadaire hors VM : `backup.yml` rapatrie `latest.sql.gz` en artefact GitHub (90 jours). Déclenchable à la main (`workflow_dispatch`).
- Restauration :
  ```bash
  cd /opt/sillygames
  docker compose stop backend
  gunzip -c backups/<fichier>.sql.gz | docker compose exec -T postgres psql -U sillygames -d sillygames
  docker compose start backend
  ```
  Pour une VM neuve : `vm-setup.sh`, copier le dump, restaurer avant le premier démarrage du backend (les migrations s'appliqueront sur un schéma déjà à jour sans dégât).

## Fournisseurs OAuth (étape 2 bis)

Chaque fournisseur est activé en posant `OAUTH_<NOM>_CLIENT_ID` et `OAUTH_<NOM>_CLIENT_SECRET` dans `.env` (VM) ou `.env` (dev), puis `docker compose up -d backend`. URL de retour à déclarer : `https://<DOMAIN>/api/auth/oauth/<nom>/callback` (en dev `http://localhost:3000/...`).

| Fournisseur | Console | Notes |
| --- | --- | --- |
| github | github.com/settings/developers > OAuth Apps > New | immédiat, localhost accepté |
| google | console.cloud.google.com > APIs & Services > Credentials > OAuth client ID (Web) | écran de consentement en mode test avec ta liste d'utilisateurs, puis « Publish » ; scopes `openid email profile` sans vérification |
| microsoft | entra.microsoft.com > App registrations > New (comptes personnels et professionnels) | secret dans Certificates & secrets, expire (24 mois max) : noter la date |
| facebook | developers.facebook.com > Create app > Facebook Login | reste en mode développement (testeurs seulement) sans revue Meta ; exige une URL de politique de confidentialité |

Contrôle : `curl https://<DOMAIN>/api/auth/providers` liste les fournisseurs actifs ; le bouton correspondant apparaît sur /login, /register et /account.

## Rotation des secrets

- `JWT_SECRET` : nouvelle valeur dans `.env`, `docker compose up -d backend`. Toutes les sessions sont invalidées, les joueurs redeviennent invités jusqu'à reconnexion.
- `POSTGRES_PASSWORD` : `docker compose exec postgres psql -U sillygames -c "ALTER USER sillygames PASSWORD '<nouveau>'"`, puis `.env`, puis `docker compose up -d backend`.
- Clé SSH de déploiement : nouvelle paire, `authorized_keys` sur la VM, secret `VM_SSH_KEY`, supprimer l'ancienne ligne.

## Plan de repli sans VM : Render + Neon

Si Oracle reste inaccessible, `deploy/render.yaml` décrit les deux services Docker sur Render (offre gratuite, mise en veille après 15 min d'inactivité, réveil en ~30 s) ; la base vient de Neon (Postgres serverless gratuit, sans carte).

1. Neon : créer un projet, copier l'URL de connexion (`postgresql://…`) et la transformer en `postgresql+psycopg://…?sslmode=require`.
2. Render : Blueprints > New Blueprint Instance > dépôt `POlc4/sillygames` > `deploy/render.yaml`. Renseigner `DATABASE_URL` (Neon) sur `sillygames-api`, et les `OAUTH_*` si besoin.
3. Le frontend relaie `/api` vers l'URL publique de l'API (variable `API_URL` fournie au build, deux domaines `onrender.com`). Vérifier après le premier déploiement que `https://sillygames-web.onrender.com/api/health` répond.
4. Ce mode n'utilise ni Caddy ni `deploy.yml` : Render reconstruit à chaque push sur `main`. Le reste (CI, sécurité, releases) est inchangé.

Point à vérifier au premier essai : que Render expose bien `API_URL` comme argument de build Docker (sinon fixer l'URL en dur dans le Dockerfile du frontend via un `ARG` renseigné dans le tableau de bord).

## PWA

- Le service worker (`frontend/public/sw.js`) met en cache les pages visitées et les assets hachés ; `/api` n'est jamais mis en cache. Quand un déploiement change les stratégies de cache, incrémenter `VERSION` dans `sw.js` : les anciens caches sont purgés à l'activation.
- Après un déploiement, les visiteurs voient la bannière « Nouvelle version disponible » à leur prochaine visite ; « Recharger » active la nouvelle version immédiatement.
- Test rapide : Chrome > DevTools > Application > Manifest (installabilité) et Service Workers (état, « Update on reload » pour forcer).

## Limites connues et améliorations

- Une VM Always Free inactive peut être récupérée par Oracle : la sauvegarde hors VM permet de tout recréer en dix minutes. Un moniteur externe gratuit (UptimeRobot) prévient de l'arrêt.
- CSP avec `'unsafe-inline'` pour les scripts : à durcir avec un nonce généré par un middleware Next.
- Limitation de débit sur `/api/auth/*` : 10 requêtes par minute et par IP (`AUTH_RATE_LIMIT`), compteur en mémoire du processus backend. Suffisant pour une instance ; à passer sur Redis si le backend est répliqué.
