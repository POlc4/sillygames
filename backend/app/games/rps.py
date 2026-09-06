"""Pierre-feuille-ciseaux en un nombre fixe de manches."""

from dataclasses import dataclass, field
from enum import StrEnum

from app.games.base import IllegalMoveError, Outcome

DEFAULT_ROUNDS = 5


class RpsMove(StrEnum):
    ROCK = "rock"
    PAPER = "paper"
    SCISSORS = "scissors"


# Chaque coup bat celui indiqué.
BEATS: dict[RpsMove, RpsMove] = {
    RpsMove.ROCK: RpsMove.SCISSORS,
    RpsMove.PAPER: RpsMove.ROCK,
    RpsMove.SCISSORS: RpsMove.PAPER,
}


def resolve(player: RpsMove, ai: RpsMove) -> Outcome:
    if player == ai:
        return Outcome.DRAW
    return Outcome.WIN if BEATS[player] == ai else Outcome.LOSS


def counter(move: RpsMove) -> RpsMove:
    """Le coup qui bat `move`."""
    return next(m for m, beaten in BEATS.items() if beaten == move)


@dataclass(frozen=True)
class RpsRound:
    player: RpsMove
    ai: RpsMove
    outcome: Outcome


@dataclass(frozen=True)
class RpsState:
    total_rounds: int = DEFAULT_ROUNDS
    rounds: tuple[RpsRound, ...] = field(default_factory=tuple)

    @property
    def player_score(self) -> int:
        return sum(1 for r in self.rounds if r.outcome is Outcome.WIN)

    @property
    def ai_score(self) -> int:
        return sum(1 for r in self.rounds if r.outcome is Outcome.LOSS)

    @property
    def finished(self) -> bool:
        return len(self.rounds) >= self.total_rounds

    @property
    def result(self) -> Outcome | None:
        if not self.finished:
            return None
        if self.player_score > self.ai_score:
            return Outcome.WIN
        if self.player_score < self.ai_score:
            return Outcome.LOSS
        return Outcome.DRAW


def new_game(total_rounds: int = DEFAULT_ROUNDS) -> RpsState:
    if total_rounds < 1:
        raise ValueError("total_rounds must be at least 1")
    return RpsState(total_rounds=total_rounds)


def play_round(state: RpsState, player: RpsMove, ai: RpsMove) -> RpsState:
    if state.finished:
        raise IllegalMoveError("game is finished")
    played = RpsRound(player=player, ai=ai, outcome=resolve(player, ai))
    return RpsState(total_rounds=state.total_rounds, rounds=(*state.rounds, played))
