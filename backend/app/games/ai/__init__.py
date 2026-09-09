"""Stratégies d'IA. Chaque stratégie reçoit l'état du jeu et renvoie un coup.

Le registre permet de choisir la stratégie par son nom (`random`, `perfect`, plus tard `ml`)
sans que les routes de l'API aient à connaître les classes.
"""

import random
from typing import Protocol

from app.games.ai.ml import NgramRps, QTableSticks
from app.games.ai.perfect import PerfectSticks
from app.games.ai.random_strategy import RandomRps, RandomSticks
from app.games.rps import RpsMove, RpsState
from app.games.sticks import SticksState


class SticksStrategy(Protocol):
    def choose(self, state: SticksState) -> int: ...


class RpsStrategy(Protocol):
    def choose(self, state: RpsState) -> RpsMove: ...


STICKS_STRATEGIES: dict[str, type[RandomSticks] | type[PerfectSticks] | type[QTableSticks]] = {
    "random": RandomSticks,
    "perfect": PerfectSticks,
    "ml": QTableSticks,
}

RPS_STRATEGIES: dict[str, type[RandomRps] | type[NgramRps]] = {
    "random": RandomRps,
    "ml": NgramRps,
}


def get_sticks_strategy(name: str, rng: random.Random | None = None) -> SticksStrategy:
    try:
        return STICKS_STRATEGIES[name](rng)
    except KeyError:
        raise ValueError(f"unknown sticks strategy: {name}") from None


def get_rps_strategy(name: str, rng: random.Random | None = None) -> RpsStrategy:
    try:
        return RPS_STRATEGIES[name](rng)
    except KeyError:
        raise ValueError(f"unknown rps strategy: {name}") from None
