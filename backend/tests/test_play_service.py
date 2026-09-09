"""Tests unitaires du service d'orchestration (sans base ni HTTP)."""

import random

import pytest
from pydantic import ValidationError

from app.games.base import Outcome
from app.services import play


def test_normalize_sticks_config_defaults_and_resolves_random_first() -> None:
    assert play.normalize_config("sticks", {}, random.Random(0)) == {
        "sticks": 21,
        "first": "player",
    }
    resolved = {
        play.normalize_config("sticks", {"first": "random"}, random.Random(i))["first"]
        for i in range(20)
    }
    assert resolved == {"player", "ai"}


def test_normalize_rps_config_defaults() -> None:
    assert play.normalize_config("rps", {}, random.Random(0)) == {"rounds": 5}


@pytest.mark.parametrize(
    ("game_type", "config"),
    [
        ("sticks", {"sticks": 4}),
        ("sticks", {"sticks": 51}),
        ("sticks", {"bogus": 1}),
        ("rps", {"rounds": 0}),
    ],
)
def test_normalize_rejects_bad_config(game_type: str, config: dict[str, int]) -> None:
    with pytest.raises(ValidationError):
        play.normalize_config(game_type, config, random.Random(0))


def test_strategy_allowed_per_game() -> None:
    assert play.strategy_allowed("sticks", "perfect")
    assert play.strategy_allowed("rps", "random")
    assert not play.strategy_allowed("rps", "perfect")
    assert play.strategy_allowed("sticks", "ml")
    assert not play.strategy_allowed("sticks", "cheater")
    assert not play.strategy_allowed("chess", "random")


def test_sticks_json_roundtrip() -> None:
    state = play.initial_state("sticks", {"sticks": 7, "first": "player"})
    assert state == {
        "sticks": 7,
        "current": "player",
        "winner": None,
        "legal_moves": [1, 2, 3],
        "finished": False,
    }
    assert play.sticks_to_json(play.sticks_from_json(state)) == state


def test_rps_json_roundtrip_after_a_round() -> None:
    state = play.initial_state("rps", {"rounds": 3})
    turn = play.play("rps", state, "rock", "random", random.Random(0))
    assert play.rps_to_json(play.rps_from_json(turn.state_after)) == turn.state_after
    assert turn.state_after["rounds"][0]["player"] == "rock"


def test_opening_only_when_ai_starts_sticks() -> None:
    assert (
        play.opening("sticks", {"sticks": 21, "first": "player"}, "random", random.Random(0))
        is None
    )
    assert play.opening("rps", {"rounds": 5}, "random", random.Random(0)) is None
    turn = play.opening("sticks", {"sticks": 21, "first": "ai"}, "perfect", random.Random(0))
    assert turn is not None
    assert turn.player_move is None
    assert turn.ai_move is not None
    assert turn.state_after["current"] == "player"
    assert turn.state_after["sticks"] == 21 - int(turn.ai_move)


def test_sticks_turn_records_player_and_ai_moves() -> None:
    state = play.initial_state("sticks", {"sticks": 21, "first": "player"})
    turn = play.play("sticks", state, 2, "perfect", random.Random(0))
    assert turn.player_move == "2"
    assert turn.ai_move == "2"  # laisse 17 = 4k+1
    assert turn.state_after["sticks"] == 17
    assert turn.state_after["current"] == "player"


def test_sticks_player_taking_last_loses_without_ai_reply() -> None:
    state = {
        "sticks": 1,
        "current": "player",
        "winner": None,
        "legal_moves": [1],
        "finished": False,
    }
    turn = play.play("sticks", state, 1, "random", random.Random(0))
    assert turn.ai_move is None
    assert turn.state_after["winner"] == "ai"
    assert play.outcome("sticks", turn.state_after) is Outcome.LOSS


def test_sticks_ai_taking_last_makes_player_win() -> None:
    state = {
        "sticks": 2,
        "current": "player",
        "winner": None,
        "legal_moves": [1, 2],
        "finished": False,
    }
    turn = play.play("sticks", state, 1, "random", random.Random(0))
    assert turn.ai_move == "1"
    assert play.outcome("sticks", turn.state_after) is Outcome.WIN


@pytest.mark.parametrize("move", [0, 4, -1, "2", 2.0, True, "rock"])
def test_sticks_rejects_invalid_moves(move: object) -> None:
    state = play.initial_state("sticks", {"sticks": 21, "first": "player"})
    with pytest.raises(play.InvalidMoveError):
        play.play("sticks", state, move, "random", random.Random(0))  # type: ignore[arg-type]


@pytest.mark.parametrize("move", ["stone", 1, ""])
def test_rps_rejects_invalid_moves(move: object) -> None:
    state = play.initial_state("rps", {"rounds": 5})
    with pytest.raises(play.InvalidMoveError):
        play.play("rps", state, move, "random", random.Random(0))  # type: ignore[arg-type]


def test_play_refuses_finished_state() -> None:
    state = {"sticks": 0, "current": "ai", "winner": "ai", "legal_moves": [], "finished": True}
    with pytest.raises(play.GameFinishedError):
        play.play("sticks", state, 1, "random", random.Random(0))


def test_rps_outcome_is_none_until_finished() -> None:
    state = play.initial_state("rps", {"rounds": 1})
    assert play.outcome("rps", state) is None
    turn = play.play("rps", state, "paper", "random", random.Random(0))
    assert play.outcome("rps", turn.state_after) in set(Outcome)
    assert turn.state_after["legal_moves"] == []
