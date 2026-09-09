# ADR 0007 — Identités externes multiples par joueur, sans fusion automatique par e-mail

Date : 2026-09-09. Statut : accepté.

## Contexte

Les joueurs veulent se connecter avec GitHub, Google, Microsoft ou Facebook. Un même humain peut arriver par plusieurs fournisseurs, parfois avec le même e-mail, parfois sans e-mail du tout (Facebook, GitHub avec e-mail privé). Le modèle existant (ADR 0003) repose sur un invité converti en compte.

## Décision

- Une table `identities` (`provider`, `provider_subject` unique par couple) rattache zéro, une ou plusieurs identités externes à un joueur. Le mot de passe reste optionnel.
- Le flux est Authorization Code + PKCE, avec `state` et `code_verifier` portés par un cookie signé de dix minutes, et lecture du profil sur l'endpoint userinfo avec le jeton d'accès. Aucune bibliothèque OAuth : httpx et PyJWT suffisent, et le flux reste lisible.
- Rattachement : identité connue → on connecte son joueur ; session invitée → l'invité est converti et garde son identifiant ; session inscrite → l'identité est liée au compte courant ; pas de session → nouveau joueur inscrit avec un pseudo dérivé du profil.
- **Pas de fusion automatique par e-mail** : deux identités portant le même e-mail chez deux fournisseurs donnent deux joueurs, sauf si l'utilisateur lie lui-même le second fournisseur depuis un compte connecté. Les e-mails ne sont pas tous vérifiés et une fusion silencieuse serait une prise de compte.
- On ne peut pas retirer la dernière méthode de connexion d'un compte (409).
- `return_to` n'accepte qu'un chemin relatif (pas de redirection ouverte).

## Conséquences

- Un fournisseur n'est actif que si son `client_id` et son secret sont configurés : les boutons apparaissent seuls, dans l'ordre du catalogue.
- Facebook reste probablement limité aux testeurs déclarés tant que l'application n'a pas passé la revue Meta.
- Les tests simulent les fournisseurs avec `httpx.MockTransport` ; aucune clé réelle n'est nécessaire en CI.
- Une future vérification d'e-mail permettrait une fusion assistée ; elle ferait l'objet d'un nouvel ADR.
