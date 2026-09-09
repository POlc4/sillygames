# ADR 0005 — L'état d'une partie est dérivé des coups, le serveur est la seule source de vérité

Date : 2026-09-09. Statut : accepté.

## Contexte

Une partie évolue coup après coup. Deux façons de la stocker : une colonne « état courant » sur `games` mise à jour à chaque coup, ou uniquement la liste des coups avec l'état avant et après chacun. Par ailleurs, le frontend pourrait appliquer les règles localement pour réagir sans attendre le serveur.

## Décision

- La table `games` n'a pas de colonne d'état. L'état courant est l'`state_after` du dernier enregistrement de `moves`, ou l'état initial recalculé depuis `config` s'il n'y a aucun coup.
- Le coup du joueur et la réponse de l'IA sont traités dans la même requête et enregistrés dans le même tour. Le coup d'ouverture de l'IA, quand elle commence, est un tour 0 sans coup joueur (migration 0002).
- Le frontend ne contient aucune règle de jeu : il envoie une intention (`move`) et affiche l'état complet renvoyé. Les plateaux 2D et 3D reçoivent l'état et émettent des intentions.
- Deux coups simultanés sur une même partie sont départagés par la contrainte unique `(game_id, turn)` ; le second reçoit 409.

## Conséquences

- Pas de désynchronisation possible entre un état stocké et l'historique : l'historique est l'état. Le dataset du ML (phase 2) est complet par construction.
- Une partie de 50 bâtonnets fait au plus une vingtaine de coups : le coût de relecture du dernier coup est négligeable.
- Le mode hors ligne de la PWA (phase 3) devra porter les règles côté client puis faire rejouer la partie par le serveur pour validation, conformément à cet ADR.
