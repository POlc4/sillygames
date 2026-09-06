import random

import pytest

from app.games import sticks
from app.games.ai import (
    SticksStrategy,
    get_rps_strategy,
    get_sticks_strategy,
)
from app.games.base import Player
from app.games.rps import RpsMove
from app.games.rps import new_game as new_rps
from app.games.sticks import SticksState

ALL_SIZES = range(sticks.MIN_STICKS, sticks.MAX_STICKS + 1)
LOSING_STARTS = [n for n in ALL_SIZES if n % 4 == 1]
WINNING_STARTS = [n for n in ALL_SIZES if n % 4 != 1]


def play_out(state: SticksState, ai: SticksStrategy, opponent: SticksStrategy) -> Player:
    """Joue une partie jusqu'au bout : l'IA testée est `Player.AI`, l'adversaire `Player.PLAYER`."""
    while not state.finished:
        mover = ai if state.current is Player.AI else opponent
        state = sticks.apply(state, mover.choose(state))
    assert state.winner is not None
    return state.winner


def test_random_sticks_only_plays_legal_moves() -> None:
    ai = get_sticks_strategy("random", random.Random(1))
    for n in ALL_SIZES:
        state = SticksState(sticks=n, current=Player.AI)
        for _ in range(20):
            assert ai.choose(state) in sticks.legal_moves(state)
    assert ai.choose(SticksState(sticks=1, current=Player.AI)) == 1


def test_random_rps_covers_all_moves() -> None:
    ai = get_rps_strategy("random", random.Random(1))
    seen = {ai.choose(new_rps()) for _ in range(200)}
    assert seen == set(RpsMove)


def test_unknown_strategy_raises() -> None:
    with pytest.raises(ValueError):
        get_sticks_strategy("nope")
    with pytest.raises(ValueError):
        get_rps_strategy("nope")


@pytest.mark.parametrize("n", LOSING_STARTS)
def test_perfect_always_wins_second_on_4k_plus_1(n: int) -> None:
    ai = get_sticks_strategy("perfect", random.Random(0))
    opponent = get_sticks_strategy("random", random.Random(n))
    for _ in range(50):
        assert play_out(sticks.new_game(n, first=Player.PLAYER), ai, opponent) is Player.AI


@pytest.mark.parametrize("n", WINNING_STARTS)
def test_perfect_always_wins_first_otherwise(n: int) -> None:
    ai = get_sticks_strategy("perfect", random.Random(0))
    opponent = get_sticks_strategy("random", random.Random(n))
    for _ in range(50):
        assert play_out(sticks.new_game(n, first=Player.AI), ai, opponent) is Player.AI


def test_perfect_vs_perfect_position_decides() -> None:
    ai = get_sticks_strategy("perfect", random.Random(0))
    other = get_sticks_strategy("perfect", random.Random(1))
    # 21 % 4 == 1 : celui qui commence perd.
    assert play_out(sticks.new_game(21, first=Player.PLAYER), ai, other) is Player.AI
    assert play_out(sticks.new_game(21, first=Player.AI), ai, other) is Player.PLAYER


def test_perfect_in_losing_position_still_plays_legal_move() -> None:
    ai = get_sticks_strategy("perfect", random.Random(0))
    state = SticksState(sticks=9, current=Player.AI)
    for _ in range(20):
        assert ai.choose(state) in sticks.legal_moves(state)
