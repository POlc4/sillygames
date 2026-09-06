# ADR 0003 — Joueur invité par défaut, convertible en compte

Date : 2026-09-06. Statut : accepté.

## Contexte

Les résultats de chaque partie doivent être stockés pour les statistiques et pour l'entraînement du modèle. Obliger la création d'un compte freinerait l'usage ; ne rien identifier empêcherait un joueur de retrouver ses stats.

## Décision

Une seule table `players`. À la première visite, l'API crée un joueur invité (`is_guest = true`) et pose un cookie JWT httpOnly portant son identifiant. L'inscription convertit la ligne invité courante (renseigne `username` et `password_hash`, passe `is_guest` à `false`). La connexion depuis un autre navigateur renvoie un cookie pour ce même joueur.

Mots de passe hachés avec argon2, jetons signés avec PyJWT. Une seule dépendance FastAPI `current_player` sert les invités et les inscrits.

## Conséquences

- L'historique de l'invité est conservé à l'inscription sans migration de données, puisque l'identifiant ne change pas.
- Pas d'e-mail, donc pas de récupération de mot de passe : acceptable pour un projet d'apprentissage, à documenter dans l'interface.
- Le champ `player_id` des parties est toujours renseigné, ce qui simplifie les requêtes de stats et le dataset ML.
