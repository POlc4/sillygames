"""Stratégies apprenantes (phase 2). Inférence en Python pur, sans numpy ni scikit-learn :
les modèles sont de petits fichiers JSON produits par les scripts de `backend/ml/`.

- Pierre-feuille-ciseaux : n-grammes. Un prior global (toutes les parties enregistrées) et une
  adaptation en cours de partie prédisent le prochain coup du joueur ; l'IA joue le contre.
- Bâtonnets : table Q apprise par auto-jeu (Q-learning). Pour chaque nombre de bâtonnets,
  la valeur de chaque retrait possible.
"""

import json
import random
from pathlib import Path
from typing import Any

from app.games.rps import RpsMove, RpsState, counter
from app.games.sticks import SticksState, legal_moves

MODELS_DIR = Path(__file__).parent / "models"
MOVES: tuple[RpsMove, ...] = (RpsMove.ROCK, RpsMove.PAPER, RpsMove.SCISSORS)
CONTEXT_LENGTHS = (0, 1, 2)
IN_GAME_WEIGHT = 2.0


def load_model(name: str) -> dict[str, Any] | None:
    path = MODELS_DIR / f"{name}.json"
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as fh:
        data: dict[str, Any] = json.load(fh)
        return data


def context_key(history: list[str], length: int) -> str:
    return "|".join(history[len(history) - length :]) if length else ""


def ngram_counts(
    sequences: list[list[str]], lengths: tuple[int, ...] = CONTEXT_LENGTHS
) -> dict[str, Any]:
    """Compte, pour chaque contexte (k derniers coups), le coup qui a suivi."""
    model: dict[str, dict[str, dict[str, int]]] = {str(k): {} for k in lengths}
    for sequence in sequences:
        for i, move in enumerate(sequence):
            for k in lengths:
                if i < k:
                    continue
                key = context_key(sequence[:i], k)
                bucket = model[str(k)].setdefault(key, {})
                bucket[move] = bucket.get(move, 0) + 1
    return model


def predict_next(model: dict[str, Any], history: list[str]) -> dict[str, float]:
    """Score de chaque coup possible du joueur au vu de son historique (plus grand = plus probable).

    Chaque longueur de contexte apporte une probabilité empirique ; les scores s'additionnent.
    """
    scores = {m.value: 0.0 for m in MOVES}
    for k_str, contexts in model.items():
        k = int(k_str)
        if len(history) < k:
            continue
        counts = contexts.get(context_key(history, k))
        if not counts:
            continue
        total = sum(counts.values())
        for move, n in counts.items():
            if move in scores:
                scores[move] += n / total
    return scores


class NgramRps:
    """Prédit le prochain coup du joueur (prior global + partie en cours) et joue le contre."""

    name = "ml"

    def __init__(
        self, rng: random.Random | None = None, prior: dict[str, Any] | None = None
    ) -> None:
        self.rng = rng or random.Random()
        self.prior = prior if prior is not None else (load_model("rps_ngram") or {})

    def choose(self, state: RpsState) -> RpsMove:
        history = [r.player.value for r in state.rounds]
        scores = predict_next(self.prior, history)
        in_game = predict_next(ngram_counts([history]), history) if history else {}
        for move, score in in_game.items():
            scores[move] += IN_GAME_WEIGHT * score
        best = max(scores.values())
        if best <= 0:
            return self.rng.choice(list(MOVES))
        candidates = [RpsMove(m) for m, s in scores.items() if s == best]
        return counter(self.rng.choice(candidates))


class QTableSticks:
    """Joue le retrait de plus grande valeur Q ; coup aléatoire légal si l'état est inconnu."""

    name = "ml"

    def __init__(
        self, rng: random.Random | None = None, table: dict[str, list[float]] | None = None
    ) -> None:
        self.rng = rng or random.Random()
        self.table = table if table is not None else (load_model("sticks_q") or {})

    def choose(self, state: SticksState) -> int:
        legal = legal_moves(state)
        values = self.table.get(str(state.sticks))
        if not values:
            return self.rng.choice(legal)
        best = max(values[take - 1] for take in legal)
        candidates = [take for take in legal if values[take - 1] == best]
        return self.rng.choice(candidates)
