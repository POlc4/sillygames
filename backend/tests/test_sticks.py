import pytest

from app.games import sticks
from app.games.base import IllegalMoveError, Player


def test_new_game_defaults() -> None:
    state = sticks.new_game()
    assert state.sticks == 21
    assert state.current is Player.PLAYER
    assert not state.finished


@pytest.mark.parametrize("n", [4, 0, -1, 51, 100])
def test_new_game_rejects_out_of_range(n: int) -> None:
    with pytest.raises(ValueError):
        sticks.new_game(n)


@pytest.mark.parametrize("n", [5, 21, 50])
def test_new_game_accepts_bounds(n: int) -> None:
    assert sticks.new_game(n).sticks == n


def test_ai_can_start() -> None:
    assert sticks.new_game(first=Player.AI).current is Player.AI


def test_legal_moves_capped_by_remaining() -> None:
    assert sticks.legal_moves(sticks.SticksState(sticks=10, current=Player.PLAYER)) == [1, 2, 3]
    assert sticks.legal_moves(sticks.SticksState(sticks=2, current=Player.PLAYER)) == [1, 2]
    assert sticks.legal_moves(sticks.SticksState(sticks=1, current=Player.PLAYER)) == [1]


def test_apply_alternates_turns() -> None:
    state = sticks.new_game(21)
    state = sticks.apply(state, 2)
    assert state.sticks == 19
    assert state.current is Player.AI
    state = sticks.apply(state, 3)
    assert state.sticks == 16
    assert state.current is Player.PLAYER


@pytest.mark.parametrize("take", [0, 4, -1])
def test_apply_rejects_illegal_take(take: int) -> None:
    with pytest.raises(IllegalMoveError):
        sticks.apply(sticks.new_game(21), take)


def test_apply_rejects_taking_more_than_remaining() -> None:
    state = sticks.SticksState(sticks=2, current=Player.PLAYER)
    with pytest.raises(IllegalMoveError):
        sticks.apply(state, 3)


def test_taking_last_stick_loses() -> None:
    state = sticks.SticksState(sticks=1, current=Player.PLAYER)
    state = sticks.apply(state, 1)
    assert state.finished
    assert state.winner is Player.AI
    assert state.sticks == 0


def test_ai_taking_last_stick_makes_player_win() -> None:
    state = sticks.SticksState(sticks=3, current=Player.AI)
    state = sticks.apply(state, 3)
    assert state.winner is Player.PLAYER


def test_no_move_after_game_over() -> None:
    state = sticks.SticksState(sticks=0, current=Player.AI, winner=Player.AI)
    assert sticks.legal_moves(state) == []
    with pytest.raises(IllegalMoveError):
        sticks.apply(state, 1)


@pytest.mark.parametrize("n", [1, 5, 9, 13, 21, 49])
def test_losing_positions(n: int) -> None:
    assert sticks.is_losing_position(n)
    assert sticks.winning_move(n) is None


@pytest.mark.parametrize(("n", "expected"), [(2, 1), (3, 2), (4, 3), (6, 1), (22, 1), (24, 3)])
def test_winning_move_leaves_4k_plus_1(n: int, expected: int) -> None:
    assert not sticks.is_losing_position(n)
    assert sticks.winning_move(n) == expected
    assert (n - expected) % 4 == 1
