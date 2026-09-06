"""IA parfaite pour les bâtonnets : laisse toujours 4k+1 bâtonnets à l'adversaire.

En position perdante (4k+1 bâtonnets à jouer), aucun coup ne sauve la partie contre
un adversaire parfait : on joue alors au hasard pour laisser une chance à l'humain
de se tromper.
"""

import random

from app.games.sticks import SticksState, legal_moves, winning_move


class PerfectSticks:
    name = "perfect"

    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()

    def choose(self, state: SticksState) -> int:
        move = winning_move(state.sticks)
        if move is not None:
            return move
        return self.rng.choice(legal_moves(state))
