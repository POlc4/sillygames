"""Jeu des bâtonnets (Nim en version « le dernier perd »).

Règles : N bâtonnets au départ, chaque joueur en retire 1 à 3, celui qui prend
le dernier a perdu. Le jeu est résolu : laisser à l'adversaire un nombre de
bâtonnets congru à 1 modulo 4 garantit la victoire.
"""

from dataclasses import dataclass, replace

from app.games.base import IllegalMoveError, Player

MIN_STICKS = 5
MAX_STICKS = 50
DEFAULT_STICKS = 21
MAX_TAKE = 3


@dataclass(frozen=True)
class SticksState:
    sticks: int
    current: Player
    winner: Player | None = None

    @property
    def finished(self) -> bool:
        return self.winner is not None


def new_game(sticks: int = DEFAULT_STICKS, first: Player = Player.PLAYER) -> SticksState:
    if not MIN_STICKS <= sticks <= MAX_STICKS:
        raise ValueError(f"sticks must be between {MIN_STICKS} and {MAX_STICKS}, got {sticks}")
    return SticksState(sticks=sticks, current=first)


def legal_moves(state: SticksState) -> list[int]:
    if state.finished:
        return []
    return list(range(1, min(MAX_TAKE, state.sticks) + 1))


def apply(state: SticksState, take: int) -> SticksState:
    if state.finished:
        raise IllegalMoveError("game is finished")
    if take not in legal_moves(state):
        raise IllegalMoveError(f"cannot take {take} sticks with {state.sticks} remaining")
    remaining = state.sticks - take
    if remaining == 0:
        # Celui qui prend le dernier bâtonnet perd.
        return replace(state, sticks=0, winner=state.current.other)
    return replace(state, sticks=remaining, current=state.current.other)


def is_losing_position(sticks: int) -> bool:
    """Vrai si le joueur qui doit jouer avec `sticks` bâtonnets perd face à un jeu parfait."""
    return sticks % 4 == 1


def winning_move(sticks: int) -> int | None:
    """Coup qui laisse 4k+1 bâtonnets à l'adversaire, ou None en position perdante."""
    take = (sticks - 1) % 4
    return take if 1 <= take <= MAX_TAKE else None
