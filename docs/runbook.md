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

## Rotation des secrets

- `JWT_SECRET` : nouvelle valeur dans `.env`, `docker compose up -d backend`. Toutes les sessions sont invalidées, les joueurs redeviennent invités jusqu'à reconnexion.
- `POSTGRES_PASSWORD` : `docker compose exec postgres psql -U sillygames -c "ALTER USER sillygames PASSWORD '<nouveau>'"`, puis `.env`, puis `docker compose up -d backend`.
- Clé SSH de déploiement : nouvelle paire, `authorized_keys` sur la VM, secret `VM_SSH_KEY`, supprimer l'ancienne ligne.

## Limites connues et améliorations

- Une VM Always Free inactive peut être récupérée par Oracle : la sauvegarde hors VM permet de tout recréer en dix minutes. Un moniteur externe gratuit (UptimeRobot) prévient de l'arrêt.
- CSP avec `'unsafe-inline'` pour les scripts : à durcir avec un nonce généré par un middleware Next.
- Pas de limitation de débit sur `/api/auth/*` : à ajouter (slowapi côté backend) avant d'ouvrir le site largement.
