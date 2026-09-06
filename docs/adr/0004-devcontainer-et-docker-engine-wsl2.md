# ADR 0004 — Devcontainer et Docker Engine dans WSL2, sans Docker Desktop

Date : 2026-09-06. Statut : accepté.

## Contexte

Poste de développement sous Windows 11. Le projet mélange Python, Node et PostgreSQL, et l'objectif est d'apprendre les conteneurs. Docker Desktop est gratuit pour un usage personnel mais ajoute une couche propriétaire ; Docker Engine s'installe directement dans la distribution Ubuntu de WSL2.

## Décision

- Docker Engine et le plugin compose installés dans Ubuntu WSL2 avec systemd activé. Même outil que sur la VM de production.
- Le dépôt vit dans le système de fichiers Linux de WSL2 (`~/sillygames`), jamais dans `C:\`, pour des accès disque à vitesse native.
- Un devcontainer (`.devcontainer/`) fournit tout l'outillage : uv et Python, Node, pre-commit, hadolint, gitleaks, psql, CLI Docker via le socket de l'hôte. Il réutilise le `docker-compose.yml` de dev pour démarrer PostgreSQL au lieu de le dupliquer.
- L'image du devcontainer ne sert jamais de base aux images de production.

## Conséquences

- Aucun outil à installer sur Windows en dehors de WSL, VS Code et ses extensions WSL et Dev Containers. Le même fichier ouvre le projet dans GitHub Codespaces.
- Le backend et le frontend se lancent en mode dev depuis le devcontainer (`uv run uvicorn`, `npm run dev`). La stack complète en conteneurs (`docker compose up --build`) se lance depuis le terminal WSL de l'hôte, car les bind mounts du compose sont exprimés en chemins hôte.
- Le démon Docker n'est actif que lorsque WSL tourne.
