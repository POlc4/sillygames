import pytest

from app.games import rps
from app.games.base import IllegalMoveError, Outcome
from app.games.rps import RpsMove

R, P, S = RpsMove.ROCK, RpsMove.PAPER, RpsMove.SCISSORS


@pytest.mark.parametrize(
    ("player", "ai", "expected"),
    [
        (R, R, Outcome.DRAW),
        (P, P, Outcome.DRAW),
        (S, S, Outcome.DRAW),
        (R, S, Outcome.WIN),
        (P, R, Outcome.WIN),
        (S, P, Outcome.WIN),
        (R, P, Outcome.LOSS),
        (P, S, Outcome.LOSS),
        (S, R, Outcome.LOSS),
    ],
)
def test_resolve_all_combinations(player: RpsMove, ai: RpsMove, expected: Outcome) -> None:
    assert rps.resolve(player, ai) is expected


@pytest.mark.parametrize("move", list(RpsMove))
def test_counter_beats_move(move: RpsMove) -> None:
    assert rps.resolve(rps.counter(move), move) is Outcome.WIN


def test_new_game_rejects_zero_rounds() -> None:
    with pytest.raises(ValueError):
        rps.new_game(0)


def test_full_game_player_wins() -> None:
    state = rps.new_game(5)
    for player, ai in [(R, S), (P, R), (S, S), (R, P), (S, P)]:
        assert not state.finished
        assert state.result is None
        state = rps.play_round(state, player, ai)
    assert state.finished
    assert state.player_score == 3
    assert state.ai_score == 1
    assert state.result is Outcome.WIN


def test_full_game_draw() -> None:
    state = rps.new_game(3)
    for player, ai in [(R, P), (P, R), (S, S)]:
        state = rps.play_round(state, player, ai)
    assert state.result is Outcome.DRAW


def test_full_game_ai_wins() -> None:
    state = rps.new_game(1)
    state = rps.play_round(state, R, P)
    assert state.result is Outcome.LOSS


def test_no_round_after_finish() -> None:
    state = rps.play_round(rps.new_game(1), R, R)
    with pytest.raises(IllegalMoveError):
        rps.play_round(state, R, R)


def test_state_is_immutable() -> None:
    start = rps.new_game(2)
    after = rps.play_round(start, R, S)
    assert len(start.rounds) == 0
    assert len(after.rounds) == 1
