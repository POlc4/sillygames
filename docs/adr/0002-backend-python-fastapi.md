# ADR 0002 — Backend en Python avec FastAPI

Date : 2026-09-06. Statut : accepté.

## Contexte

Le frontend est en Next.js (React), préférence de l'auteur. Le backend expose l'API des jeux et doit, en phase 2, servir un modèle de machine learning entraîné sur les parties enregistrées. Deux options : tout en TypeScript (Fastify) avec un service ML Python séparé, ou un backend Python.

## Décision

Backend en Python 3.12 avec FastAPI, SQLAlchemy 2 et Alembic, géré avec uv. La logique de jeu et les stratégies d'IA sont des modules purs, sans dépendance à la base, derrière une interface `AIStrategy.choose(state, history)`.

## Conséquences

- Un seul langage pour l'API, l'entraînement (scikit-learn, pandas) et l'inférence : le modèle se charge directement dans le processus de l'API.
- Deux écosystèmes à outiller (Python et Node) dans le devcontainer et la CI.
- Les moteurs de jeu étant purs, ils sont testés sans base ni serveur.
