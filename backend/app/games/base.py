"""Types communs aux moteurs de jeu."""

from enum import StrEnum


class Player(StrEnum):
    """Qui joue : le joueur humain ou l'IA."""

    PLAYER = "player"
    AI = "ai"

    @property
    def other(self) -> "Player":
        return Player.AI if self is Player.PLAYER else Player.PLAYER


class Outcome(StrEnum):
    """Résultat du point de vue du joueur humain."""

    WIN = "win"
    LOSS = "loss"
    DRAW = "draw"


class IllegalMoveError(ValueError):
    """Coup interdit par les règles ou hors tour."""
