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
- Settings > Rules > Rulesets sur `main` : PR obligatoire, checks requis (`Backend`, `Frontend`, `Images`, `Secrets (gitleaks)`), pas de force push, historique linéaire.
- Secrets (Settings > Secrets and variables > Actions) :
  - `CLAUDE_CODE_OAUTH_TOKEN` : posé par `claude /install-github-app` depuis le terminal, ou à la main. Sans lui, les workflows Claude se sautent proprement.
  - `VM_HOST`, `VM_USER`, `VM_SSH_KEY` : étape 7, dans l'environnement `production`.

## Vérifier avant de merger

```bash
./scripts/backend-check.sh     # ruff, mypy, alembic, pytest contre Postgres
./scripts/frontend-check.sh    # prettier, eslint, tsc, vitest + couverture, build
./scripts/e2e.sh               # stack compose + Playwright
```

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

## Déploiement, rollback, sauvegardes

À écrire à l'étape 7 (VM, Caddy, GHCR, SSH), avec les commandes exactes.
