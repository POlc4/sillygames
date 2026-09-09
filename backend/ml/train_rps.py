"""Prior n-grammes pour pierre-feuille-ciseaux, à partir des séquences de coups des joueurs.

Entrée : JSONL produit par `ml.export`, une ligne par partie : {"moves": ["rock", "paper", ...]}.
Sortie : app/games/ai/models/rps_ngram.json, lu par NgramRps au démarrage du backend.
Évaluation : les parties sont coupées en deux (les plus anciennes pour apprendre, les plus récentes
pour tester) et on mesure la justesse de la prédiction du coup suivant face au hasard (33 %).

    uv run python -m ml.train_rps data/rps.jsonl
"""

import argparse
import json
from pathlib import Path
from typing import Any

from app.games.ai.ml import MODELS_DIR, ngram_counts, predict_next


def load_sequences(path: Path) -> list[list[str]]:
    sequences: list[list[str]] = []
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                moves = json.loads(line)["moves"]
                if len(moves) >= 2:
                    sequences.append(list(moves))
    return sequences


def accuracy(model: dict[str, Any], sequences: list[list[str]]) -> float:
    """Justesse de argmax(predict_next) sur chaque coup ayant au moins un coup d'historique."""
    hits = 0
    total = 0
    for sequence in sequences:
        for i in range(1, len(sequence)):
            scores = predict_next(model, sequence[:i])
            best = max(scores.values())
            if best <= 0:
                continue
            predicted = [m for m, s in scores.items() if s == best]
            total += 1
            hits += len(predicted) == 1 and predicted[0] == sequence[i]
    return hits / total if total else 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", type=Path, help="JSONL exporté par ml.export")
    parser.add_argument("--out", type=Path, default=MODELS_DIR / "rps_ngram.json")
    parser.add_argument("--min-games", type=int, default=20)
    args = parser.parse_args()

    sequences = load_sequences(args.data)
    if len(sequences) < args.min_games:
        raise SystemExit(
            f"{len(sequences)} parties : trop peu pour apprendre (min {args.min_games})"
        )

    split = int(len(sequences) * 0.8)
    train_seq, test_seq = sequences[:split], sequences[split:]
    holdout = ngram_counts(train_seq)
    print(f"parties : {len(sequences)} (apprentissage {len(train_seq)}, test {len(test_seq)})")
    print(f"justesse sur le test : {accuracy(holdout, test_seq):.1%} (hasard : 33.3 %)")

    model = ngram_counts(sequences)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(model, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"modèle écrit dans {args.out}")


if __name__ == "__main__":
    main()
