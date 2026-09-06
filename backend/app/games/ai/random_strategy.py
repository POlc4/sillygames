"""IA aléatoire : joue un coup légal au hasard. Stratégie de référence de la phase 1."""

import random

from app.games.rps import RpsMove, RpsState
from app.games.sticks import SticksState, legal_moves


class RandomSticks:
    name = "random"

    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()

    def choose(self, state: SticksState) -> int:
        return self.rng.choice(legal_moves(state))


class RandomRps:
    name = "random"

    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()

    def choose(self, state: RpsState) -> RpsMove:
        return self.rng.choice(list(RpsMove))
