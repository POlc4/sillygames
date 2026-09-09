# ADR 0006 — Images de base via un miroir public et déploiement déclenché par la CI

Date : 2026-09-09. Statut : accepté.

## Contexte

Le job de construction des images échouait sur les runners GitHub alors que le même build passait en local. Les runners partagent des adresses IP et Docker Hub limite fortement les pulls anonymes. Par ailleurs, il faut décider quand déployer : à chaque push, ou seulement après validation.

## Décision

- Les images de base officielles (`postgres`, `python`, `node`, `caddy`) sont tirées de `mirror.gcr.io/library/…`, miroir public de Docker Hub tenu par Google, aux mêmes digests. L'image `uv` reste sur GHCR. Pas de compte Docker Hub, conformément à la règle de gratuité et de simplicité.
- La directive `# syntax=docker/dockerfile:…` est retirée : BuildKit natif suffit pour `RUN --mount=type=cache`, et c'est un pull de moins.
- Le workflow de déploiement s'exécute sur `workflow_run` du workflow CI, uniquement si sa conclusion est un succès sur `main`, et construit le commit exact validé (`head_sha`). Rien n'est déployé sans CI verte.
- Les images sont taguées `sha-<commit>` (immuable, base du rollback) et `latest` ; les tags `vX.Y.Z` suivent les releases.

## Conséquences

- Dependabot suit les tags `mirror.gcr.io/library/*` comme n'importe quel registre ; à surveiller à la première PR de mise à jour.
- Le miroir Google n'a pas de garantie de service ; en cas de panne, revenir aux images Docker Hub avec une authentification (secret `DOCKERHUB_TOKEN`) est un changement de trois lignes.
- Un correctif urgent passe obligatoirement par la CI (quelques minutes). C'est voulu.
