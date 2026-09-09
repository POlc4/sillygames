"""Parties : création, coup par coup avec réponse de l'IA, consultation."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.auth.deps import CurrentPlayer, DbSession
from app.deps import Rng
from app.models import Game, Move
from app.schemas import GameCreate, GameOut, GameSummary, MoveIn, MoveOut
from app.services import play

router = APIRouter(prefix="/games", tags=["games"])

MAX_LISTED = 50


def _current_state(game: Game) -> dict[str, object]:
    if game.moves:
        return game.moves[-1].state_after
    return play.initial_state(game.game_type, game.config)


def _to_out(game: Game) -> GameOut:
    summary = GameSummary.model_validate(game)
    return GameOut(
        **summary.model_dump(),
        state=_current_state(game),
        moves=[MoveOut.model_validate(m) for m in game.moves],
    )


def _record(game: Game, turn: play.Turn) -> None:
    next_turn = game.moves[-1].turn + 1 if game.moves else (0 if turn.player_move is None else 1)
    game.moves.append(
        Move(
            turn=next_turn,
            state_before=turn.state_before,
            player_move=turn.player_move,
            ai_move=turn.ai_move,
            state_after=turn.state_after,
        )
    )
    result = play.outcome(game.game_type, turn.state_after)
    if result is not None:
        game.status = "finished"
        game.result = result.value
        game.finished_at = datetime.now(UTC)


def _load(db: DbSession, game_id: uuid.UUID, player: CurrentPlayer) -> Game:
    game = db.scalar(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.player_id == player.id)
    )
    if game is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "game not found")
    return game


@router.post("", response_model=GameOut, status_code=status.HTTP_201_CREATED)
def create_game(body: GameCreate, player: CurrentPlayer, db: DbSession, rng: Rng) -> GameOut:
    if not play.strategy_allowed(body.game_type, body.ai_strategy):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"unknown strategy {body.ai_strategy!r} for {body.game_type}",
        )
    try:
        config = play.normalize_config(body.game_type, body.config, rng)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, exc.errors()) from exc

    game = Game(
        player_id=player.id,
        game_type=body.game_type,
        ai_strategy=body.ai_strategy,
        config=config,
        status="in_progress",
    )
    first_turn = play.opening(body.game_type, config, body.ai_strategy, rng)
    if first_turn is not None:
        _record(game, first_turn)
    db.add(game)
    db.commit()
    db.refresh(game)
    return _to_out(game)


@router.get("", response_model=list[GameSummary])
def list_games(player: CurrentPlayer, db: DbSession) -> list[Game]:
    return list(
        db.scalars(
            select(Game)
            .where(Game.player_id == player.id)
            .order_by(Game.started_at.desc())
            .limit(MAX_LISTED)
        )
    )


@router.get("/{game_id}", response_model=GameOut)
def get_game(game_id: uuid.UUID, player: CurrentPlayer, db: DbSession) -> GameOut:
    return _to_out(_load(db, game_id, player))


@router.post("/{game_id}/moves", response_model=GameOut)
def play_move(
    game_id: uuid.UUID, body: MoveIn, player: CurrentPlayer, db: DbSession, rng: Rng
) -> GameOut:
    game = _load(db, game_id, player)
    if game.status != "in_progress":
        raise HTTPException(status.HTTP_409_CONFLICT, "game is finished")
    try:
        turn = play.play(game.game_type, _current_state(game), body.move, game.ai_strategy, rng)
    except play.GameFinishedError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except play.InvalidMoveError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    _record(game, turn)
    try:
        db.commit()
    except IntegrityError as exc:
        # Deux coups simultanés sur la même partie : la contrainte (game_id, turn) tranche.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "concurrent move") from exc
    db.refresh(game)
    return _to_out(game)
