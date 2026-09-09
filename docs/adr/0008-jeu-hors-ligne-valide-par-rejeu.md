# ADR 0008 — Jeu hors ligne avec moteurs locaux, validé par rejeu côté serveur

Date : 2026-09-09. Statut : accepté.

## Contexte

La PWA doit permettre de jouer sans réseau (phase 3, palier 2). Or l'ADR 0005 fait du serveur la seule source de vérité : aucune règle de jeu côté client en ligne. Il faut concilier les deux sans dupliquer la confiance.

## Décision

- Les moteurs et les stratégies `random` et `perfect` sont portés en TypeScript (`frontend/lib/engines`) avec les mêmes tests que le backend. Ils ne servent **que** hors ligne ; en ligne, le client continue d'envoyer des intentions au serveur.
- Une partie locale a la même forme qu'une réponse de l'API (`Game`), avec un identifiant préfixé `local:`. Les pages et les plateaux ne font pas la différence.
- Les parties locales terminées sont mises en file dans `localStorage` (quelques Ko, testable dans jsdom ; IndexedDB serait de la complexité sans gain à ce volume) et envoyées à `POST /api/games/import` au retour du réseau.
- Le serveur **rejoue** chaque partie importée coup par coup : coups légaux, enchaînement des tours, partie terminée. Les coups de l'IA choisis par le client sont validés mais pas reproduits (leur aléa n'est pas rejouable). Une partie refusée (422) est abandonnée côté client ; une panne conserve la file.
- Les parties importées portent `offline: true` dans leur config pour rester distinguables dans les statistiques et le dataset ML.
- La stratégie `ml` n'est pas disponible hors ligne : ses modèles vivent côté serveur.

## Conséquences

- Deux implémentations des règles à maintenir en parallèle, protégées par des tests miroirs. La phase 4 (Rust/WASM) proposerait une implémentation unique si ce coût devient gênant.
- Un client malveillant peut fabriquer une partie « gagnée » hors ligne : le rejeu garantit la cohérence des règles, pas la sincérité. C'est acceptable pour un site d'apprentissage ; les stats pourraient exclure les parties `offline` d'un classement compétitif.
- Le bandeau `OfflineStatus` rend l'état visible et offre une synchronisation manuelle.
