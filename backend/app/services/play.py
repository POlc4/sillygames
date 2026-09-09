"""Orchestration d'une partie : état JSON <-> moteurs purs, coup du joueur puis réponse de l'IA.

Ce module ne touche ni à la base ni à HTTP. Les routes stockent les `Turn` produits ici.
"""

import random
from dataclasses import dataclass
from typing import Any

from app.games import rps, sticks
from app.games.ai import get_rps_strategy, get_sticks_strategy
from app.games.base import IllegalMoveError, Outcome, Player
from app.games.rps import RpsMove, RpsRound, RpsState
from app.games.sticks import SticksState
from app.schemas import RpsConfig, SticksConfig

# Stratégies d'IA acceptées par jeu.
STRATEGIES: dict[str, frozenset[str]] = {
    "sticks": frozenset({"random", "perfect", "ml"}),
    "rps": frozenset({"random", "ml"}),
}


class InvalidMoveError(ValueError):
    """Coup mal formé ou interdit par les règles (erreur 422 côté API)."""


class GameFinishedError(ValueError):
    """La partie est terminée, plus aucun coup n'est accepté (erreur 409 côté API)."""


@dataclass(frozen=True)
class Turn:
    state_before: dict[str, Any]
    player_move: str | None
    ai_move: str | None
    state_after: dict[str, Any]


# --- Configuration --------------------------------------------------------------


def normalize_config(game_type: str, config: dict[str, Any], rng: random.Random) -> dict[str, Any]:
    """Valide la config et résout les valeurs aléatoires (qui commence) pour la rendre rejouable."""
    if game_type == "sticks":
        parsed = SticksConfig.model_validate(config)
        first = rng.choice(["player", "ai"]) if parsed.first == "random" else parsed.first
        return {"sticks": parsed.sticks, "first": first}
    return RpsConfig.model_validate(config).model_dump()


def strategy_allowed(game_type: str, strategy: str) -> bool:
    return strategy in STRATEGIES.get(game_type, frozenset())


# --- Sérialisation ----------------------------------------------------------------


def sticks_to_json(state: SticksState) -> dict[str, Any]:
    return {
        "sticks": state.sticks,
        "current": state.current.value,
        "winner": state.winner.value if state.winner else None,
        "legal_moves": sticks.legal_moves(state),
        "finished": state.finished,
    }


def sticks_from_json(data: dict[str, Any]) -> SticksState:
    return SticksState(
        sticks=int(data["sticks"]),
        current=Player(data["current"]),
        winner=Player(data["winner"]) if data.get("winner") else None,
    )


def rps_to_json(state: RpsState) -> dict[str, Any]:
    return {
        "total_rounds": state.total_rounds,
        "rounds": [
            {"player": r.player.value, "ai": r.ai.value, "outcome": r.outcome.value}
            for r in state.rounds
        ],
        "player_score": state.player_score,
        "ai_score": state.ai_score,
        "finished": state.finished,
        "legal_moves": [] if state.finished else [m.value for m in RpsMove],
    }


def rps_from_json(data: dict[str, Any]) -> RpsState:
    return RpsState(
        total_rounds=int(data["total_rounds"]),
        rounds=tuple(
            RpsRound(RpsMove(r["player"]), RpsMove(r["ai"]), Outcome(r["outcome"]))
            for r in data["rounds"]
        ),
    )


# --- Déroulement ------------------------------------------------------------------


def initial_state(game_type: str, config: dict[str, Any]) -> dict[str, Any]:
    if game_type == "sticks":
        return sticks_to_json(sticks.new_game(config["sticks"], Player(config["first"])))
    return rps_to_json(rps.new_game(config["rounds"]))


def opening(
    game_type: str, config: dict[str, Any], strategy: str, rng: random.Random
) -> Turn | None:
    """Coup d'ouverture de l'IA quand elle commence (bâtonnets uniquement), sinon None."""
    if game_type != "sticks" or config["first"] != "ai":
        return None
    state = sticks.new_game(config["sticks"], Player.AI)
    take = get_sticks_strategy(strategy, rng).choose(state)
    after = sticks.apply(state, take)
    return Turn(sticks_to_json(state), None, str(take), sticks_to_json(after))


def play(
    game_type: str,
    state: dict[str, Any],
    move: int | str,
    strategy: str,
    rng: random.Random,
) -> Turn:
    """Applique le coup du joueur puis, si la partie continue, celui de l'IA."""
    if state.get("finished"):
        raise GameFinishedError("game is finished")
    if game_type == "sticks":
        return _play_sticks(state, move, strategy, rng)
    return _play_rps(state, move, strategy, rng)


def _play_sticks(
    state_json: dict[str, Any], move: int | str, strategy: str, rng: random.Random
) -> Turn:
    if isinstance(move, bool) or not isinstance(move, int):
        raise InvalidMoveError("move must be an integer number of sticks")
    state = sticks_from_json(state_json)
    if state.current is not Player.PLAYER:
        raise InvalidMoveError("not the player's turn")
    try:
        after_player = sticks.apply(state, move)
    except IllegalMoveError as exc:
        raise InvalidMoveError(str(exc)) from exc
    if after_player.finished:
        return Turn(sticks_to_json(state), str(move), None, sticks_to_json(after_player))
    take = get_sticks_strategy(strategy, rng).choose(after_player)
    after_ai = sticks.apply(after_player, take)
    return Turn(sticks_to_json(state), str(move), str(take), sticks_to_json(after_ai))


def _play_rps(
    state_json: dict[str, Any], move: int | str, strategy: str, rng: random.Random
) -> Turn:
    if not isinstance(move, str):
        raise InvalidMoveError("move must be rock, paper or scissors")
    try:
        player_move = RpsMove(move)
    except ValueError as exc:
        raise InvalidMoveError("move must be rock, paper or scissors") from exc
    state = rps_from_json(state_json)
    ai_move = get_rps_strategy(strategy, rng).choose(state)
    after = rps.play_round(state, player_move, ai_move)
    return Turn(rps_to_json(state), player_move.value, ai_move.value, rps_to_json(after))


def outcome(game_type: str, state: dict[str, Any]) -> Outcome | None:
    """Résultat du point de vue du joueur, None tant que la partie n'est pas finie."""
    if game_type == "sticks":
        winner = state.get("winner")
        if winner is None:
            return None
        return Outcome.WIN if winner == Player.PLAYER.value else Outcome.LOSS
    return rps_from_json(state).result
