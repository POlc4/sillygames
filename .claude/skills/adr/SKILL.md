---
name: adr
description: Rédiger un Architecture Decision Record dans docs/adr au format du projet (contexte, décision, conséquences), avec le prochain numéro libre. À utiliser dès qu'une décision d'architecture est prise ou remplacée.
---

# Écrire un ADR

1. Trouver le prochain numéro : `ls docs/adr | sort | tail -1`, incrémenter (quatre chiffres).
2. Nom de fichier : `docs/adr/NNNN-titre-en-kebab-case.md`, titre en français.
3. Contenu, dans cet ordre, en français :

```markdown
# ADR NNNN — Titre

Date : AAAA-MM-JJ. Statut : accepté | remplacé par ADR MMMM | abandonné.

## Contexte
Le problème, les contraintes (gratuité, apprentissage, stack existante), les options étudiées.

## Décision
Ce qui est décidé, en phrases affirmatives. Une décision par ADR.

## Conséquences
Ce que ça permet, ce que ça coûte, ce qu'il faudra surveiller. Les points négatifs aussi.
```

4. Si l'ADR remplace une décision existante, mettre à jour le statut de l'ancien (« remplacé par ADR NNNN ») sans modifier son contenu.
5. Référencer l'ADR depuis le code ou la doc concernée si utile (`Voir docs/adr/NNNN`).
6. Ajouter une ligne dans le journal du README si la décision change une commande ou une pratique.

Ne jamais supprimer un ADR.
