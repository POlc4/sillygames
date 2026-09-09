"""Stratégies apprenantes : inférence à partir de modèles fournis en mémoire."""

import random

from app.games import rps, sticks
from app.games.ai import get_rps_strategy, get_sticks_strategy
from app.games.ai.ml import NgramRps, QTableSticks, ngram_counts, predict_next
from app.games.base import Player
from app.games.rps import RpsMove
from app.games.sticks import SticksState

R, P, S = RpsMove.ROCK, RpsMove.PAPER, RpsMove.SCISSORS


def rps_state(*player_moves: RpsMove) -> rps.RpsState:
    state = rps.new_game(20)
    for move in player_moves:
        state = rps.play_round(state, move, R)
    return state


def test_ngram_counts_indexes_every_context_length() -> None:
    model = ngram_counts([["rock", "rock", "paper"]])
    assert model["0"][""] == {"rock": 2, "paper": 1}
    assert model["1"]["rock"] == {"rock": 1, "paper": 1}
    assert model["2"]["rock|rock"] == {"paper": 1}


def test_predict_next_combines_context_lengths() -> None:
    model = ngram_counts([["rock", "rock", "paper"], ["rock", "rock", "paper"]])
    scores = predict_next(model, ["rock", "rock"])
    assert scores["paper"] > scores["rock"] > scores["scissors"] == 0


def test_ngram_rps_counters_a_repetitive_player_without_prior() -> None:
    ai = NgramRps(random.Random(0), prior={})
    state = rps_state(R, R, R, R)
    assert ai.choose(state) is P  # le joueur répète pierre : l'IA joue feuille


def test_ngram_rps_uses_the_global_prior_on_the_first_round() -> None:
    prior = ngram_counts([["scissors"] * 5])
    ai = NgramRps(random.Random(0), prior=prior)
    assert ai.choose(rps.new_game()) is R  # les joueurs ouvrent souvent ciseaux : pierre


def test_ngram_rps_is_random_without_any_information() -> None:
    ai = NgramRps(random.Random(3), prior={})
    seen = {ai.choose(rps.new_game()) for _ in range(60)}
    assert seen == set(RpsMove)


def test_in_game_pattern_beats_the_prior() -> None:
    prior = ngram_counts([["rock", "rock", "rock"]] * 10)
    ai = NgramRps(random.Random(0), prior=prior)
    state = rps_state(S, S, S, S, S, S)
    assert ai.choose(state) is R  # ce joueur-ci joue ciseaux : pierre


def test_qtable_sticks_plays_the_best_valued_legal_move() -> None:
    table = {"5": [0.1, 0.9, -1.0], "2": [1.0, -1.0, 0.0]}
    ai = QTableSticks(random.Random(0), table=table)
    assert ai.choose(SticksState(sticks=5, current=Player.AI)) == 2
    assert ai.choose(SticksState(sticks=2, current=Player.AI)) == 1


def test_qtable_sticks_falls_back_to_random_legal_moves() -> None:
    ai = QTableSticks(random.Random(0), table={})
    for _ in range(20):
        assert ai.choose(SticksState(sticks=2, current=Player.AI)) in (1, 2)


def test_ml_strategies_are_registered() -> None:
    assert isinstance(get_sticks_strategy("ml", random.Random(0)), QTableSticks)
    assert isinstance(get_rps_strategy("ml", random.Random(0)), NgramRps)


def test_shipped_sticks_model_beats_random_and_matches_perfect() -> None:
    ai = get_sticks_strategy("ml", random.Random(0))
    opponent = get_sticks_strategy("random", random.Random(1))
    wins = 0
    for n in range(sticks.MIN_STICKS, sticks.MAX_STICKS + 1):
        for _ in range(4):
            state = sticks.new_game(n, first=Player.PLAYER if n % 4 == 1 else Player.AI)
            while not state.finished:
                mover = ai if state.current is Player.AI else opponent
                state = sticks.apply(state, mover.choose(state))
            wins += state.winner is Player.AI
    assert wins >= 0.95 * 4 * (sticks.MAX_STICKS - sticks.MIN_STICKS + 1)
