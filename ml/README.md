# Phase 2 — apprentissage sur les parties enregistrées

Les scripts vivent dans `backend/ml/` (ils réutilisent les moteurs de jeu et l'accès à la base) ; ce dossier documente la démarche.

## Principe

- **Inférence sans dépendance lourde** : les stratégies `ml` du backend (`backend/app/games/ai/ml.py`) lisent de petits fichiers JSON dans `backend/app/games/ai/models/`. Ni numpy ni scikit-learn dans l'image de production.
- **Pierre-feuille-ciseaux** : n-grammes. Un prior global appris sur toutes les parties (`rps_ngram.json`) et une adaptation en cours de partie prédisent le prochain coup du joueur ; l'IA joue le contre. Sans prior, l'IA n'apprend que du joueur en face, ce qui suffit déjà contre les joueurs répétitifs.
- **Bâtonnets** : Q-learning tabulaire par auto-jeu (`sticks_q.json`). Le jeu est résolu : l'intérêt est de mesurer à quelle vitesse l'agent redécouvre la règle « laisser 4k+1 » (`agreement_with_perfect`).

## Commandes (depuis `backend/`)

```bash
uv run python -m ml.train_sticks                 # auto-jeu, écrit sticks_q.json, affiche l'accord avec la stratégie parfaite
uv run python -m ml.export > ../ml/data/rps.jsonl   # séquences des parties RPS terminées (DATABASE_URL)
uv run python -m ml.train_rps ../ml/data/rps.jsonl  # prior n-grammes + justesse sur un jeu de test
```

Sur la VM, l'export se fait dans le conteneur : `docker compose exec -T backend python -m ml.export > rps.jsonl`. Le workflow `train.yml` enchaîne export, entraînement et ouverture d'une PR avec le modèle mis à jour ; la CI puis la revue s'appliquent comme pour tout changement.

## Mesurer le gain

Les stats (`/api/stats/global`) sont agrégées par stratégie d'IA : le taux de victoire des joueurs face à `ml` comparé à `random` est la mesure du gain. Choisir l'adversaire « Apprenante » dans l'interface pour alimenter la comparaison.

## Pistes suivantes

- Modèle par joueur (prior + historique du joueur sur toutes ses parties) : nécessite un export par joueur et un cache côté backend.
- Fenêtre glissante et pondération temporelle pour suivre un joueur qui change de tactique.
- Comparaison avec un modèle scikit-learn (régression logistique sur les k derniers coups et résultats) dans un notebook, hors production, pour vérifier que les n-grammes ne laissent pas trop de justesse sur la table.
