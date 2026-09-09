"""Q-learning tabulaire pour les bâtonnets, par auto-jeu.

État : nombre de bâtonnets restants (le joueur au trait). Action : retirer 1, 2 ou 3.
Récompense : +1 si l'adversaire finit par prendre le dernier, -1 si c'est nous. Les deux camps
partagent la même table (jeu à somme nulle) : Q(s, a) = r - gamma * max_a' Q(s', a').

    uv run python -m ml.train_sticks            # écrit app/games/ai/models/sticks_q.json
    uv run python -m ml.train_sticks --episodes 50000 --seed 1
"""

import argparse
import json
import random
from pathlib import Path

from app.games import sticks
from app.games.ai.ml import MODELS_DIR
from app.games.base import Player
from app.games.sticks import MAX_STICKS, MAX_TAKE, MIN_STICKS, SticksState, winning_move

ACTIONS = tuple(range(1, MAX_TAKE + 1))


def train(
    episodes: int = 20000,
    seed: int = 0,
    alpha: float = 0.2,
    gamma: float = 1.0,
    epsilon: float = 0.2,
) -> dict[str, list[float]]:
    rng = random.Random(seed)
    q: dict[int, list[float]] = {n: [0.0] * MAX_TAKE for n in range(1, MAX_STICKS + 1)}

    for _ in range(episodes):
        state = sticks.new_game(rng.randint(MIN_STICKS, MAX_STICKS), Player.PLAYER)
        while not state.finished:
            legal = sticks.legal_moves(state)
            if rng.random() < epsilon:
                take = rng.choice(legal)
            else:
                best = max(q[state.sticks][a - 1] for a in legal)
                take = rng.choice([a for a in legal if q[state.sticks][a - 1] == best])
            after = sticks.apply(state, take)
            if after.finished:
                # Celui qui vient de jouer a pris le dernier bâtonnet : il a perdu.
                target = -1.0
            else:
                target = -gamma * max(q[after.sticks][a - 1] for a in sticks.legal_moves(after))
            q[state.sticks][take - 1] += alpha * (target - q[state.sticks][take - 1])
            state = after
    return {str(n): [round(v, 4) for v in values] for n, values in q.items()}


def agreement_with_perfect(table: dict[str, list[float]]) -> float:
    """Part des positions gagnantes où la table choisit le coup parfait (laisser 4k+1)."""
    hits = 0
    total = 0
    for n in range(2, MAX_STICKS + 1):
        expected = winning_move(n)
        if expected is None:
            continue
        legal = sticks.legal_moves(SticksState(sticks=n, current=Player.AI))
        best = max(table[str(n)][a - 1] for a in legal)
        chosen = [a for a in legal if table[str(n)][a - 1] == best]
        total += 1
        hits += chosen == [expected]
    return hits / total


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--episodes", type=int, default=20000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path, default=MODELS_DIR / "sticks_q.json")
    args = parser.parse_args()

    table = train(episodes=args.episodes, seed=args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(table, indent=1) + "\n", encoding="utf-8")
    print(f"table Q écrite dans {args.out}")
    print(f"accord avec la stratégie parfaite : {agreement_with_perfect(table):.1%}")


if __name__ == "__main__":
    main()
