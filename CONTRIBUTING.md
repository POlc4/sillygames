# Contribuer

Projet d'apprentissage personnel, mais tenu comme un projet d'équipe : les règles ci-dessous s'appliquent à tout le monde, y compris à Claude.

## Démarrer

1. Cloner dans WSL2 (`~/sillygames`), ouvrir dans VS Code, « Reopen in Container ».
2. `cp .env.example .env`, puis `docker compose up -d postgres` depuis le terminal du devcontainer.
3. Backend : `cd backend && uv run pytest`. Frontend : `cd frontend && npm test`.

Sans devcontainer, les mêmes vérifications tournent dans des conteneurs jetables : `./scripts/backend-check.sh`, `./scripts/frontend-check.sh`, `./scripts/e2e.sh`.

## Cycle d'une contribution

1. Une branche par intention, depuis `main`.
2. Des commits Conventional Commits en anglais (`feat(backend): ...`). Le CHANGELOG en dérive.
3. Tout comportement ajouté ou modifié arrive avec ses tests (voir CLAUDE.md, section Tests).
4. Ouvrir une PR avec le template rempli. La CI (qualité, sécurité, images, e2e) doit être verte.
5. Squash merge dans `main`. Le déploiement suit automatiquement, puis release-please propose la release.

## Documentation

- Décision d'architecture : un ADR dans `docs/adr/`, numéro suivant, format contexte / décision / conséquences.
- Commande utile ou piège rencontré : une entrée dans le journal du README.
- Changement d'infra : `docs/runbook.md`.

## Sécurité

- Aucun secret dans le dépôt. `gitleaks` tourne en pre-commit et en CI.
- Actions GitHub épinglées par SHA de commit, jamais `pull_request_target`.
- Signaler une vulnérabilité par le formulaire privé de GitHub (Security > Report a vulnerability), pas par une issue publique.
