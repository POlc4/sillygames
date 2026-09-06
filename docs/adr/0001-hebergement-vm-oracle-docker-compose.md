# ADR 0001 — Hébergement sur une VM Oracle Always Free pilotée par docker compose

Date : 2026-09-06. Statut : accepté.

## Contexte

Le projet sert à apprendre le déploiement conteneurisé. La règle d'or est la gratuité totale. Les options gratuites étudiées : Render et Koyeb (déploiement d'une image sans carte bancaire, mise en veille), Google Cloud Run (carte requise, scale-to-zero), VM Oracle Cloud Always Free (carte requise, VM Linux complète).

## Décision

Une VM Ubuntu sur Oracle Cloud Always Free, avec Docker Engine et un `docker-compose.prod.yml` qui lance Caddy (reverse proxy, HTTPS automatique), le frontend, le backend et PostgreSQL. Les images sont construites par GitHub Actions, publiées sur GHCR et tirées par la VM lors d'un déploiement déclenché en SSH.

## Conséquences

- C'est l'option la plus formatrice : réseau Docker, volumes, reverse proxy, sauvegardes, ports et pare-feu sont manipulés à la main.
- L'inscription Oracle peut échouer et la capacité ARM manquer. Plan de repli documenté dans `docs/plan.md` : Render + Neon, mêmes Dockerfiles, seul le job de déploiement change.
- Une VM Always Free peut être récupérée par Oracle après 7 jours d'inactivité. Un keep-alive et des sauvegardes hors VM sont prévus.
- La base tourne dans un conteneur avec un volume : sauvegardes `pg_dump` à mettre en place dès la mise en ligne.
