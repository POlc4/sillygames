"""Agrégats de résultats : par joueur, globaux, classement."""

import uuid

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models import Game, Player
from app.schemas import GlobalStats, LeaderboardEntry, PlayerStats, StatLine


def _lines_query(player_id: uuid.UUID | None) -> Select[tuple[str, str, int, int, int, int]]:
    wins = func.count().filter(Game.result == "win")
    losses = func.count().filter(Game.result == "loss")
    draws = func.count().filter(Game.result == "draw")
    query = (
        select(Game.game_type, Game.ai_strategy, func.count(), wins, losses, draws)
        .where(Game.status == "finished")
        .group_by(Game.game_type, Game.ai_strategy)
        .order_by(Game.game_type, Game.ai_strategy)
    )
    if player_id is not None:
        query = query.where(Game.player_id == player_id)
    return query


def _rate(wins: int, games: int) -> float:
    return round(wins / games, 3) if games else 0.0


def _lines(db: Session, player_id: uuid.UUID | None) -> list[StatLine]:
    return [
        StatLine(
            game_type=game_type,
            ai_strategy=ai_strategy,
            games=games,
            wins=wins,
            losses=losses,
            draws=draws,
            win_rate=_rate(wins, games),
        )
        for game_type, ai_strategy, games, wins, losses, draws in db.execute(
            _lines_query(player_id)
        )
    ]


def player_stats(db: Session, player_id: uuid.UUID) -> PlayerStats:
    lines = _lines(db, player_id)
    return PlayerStats(
        lines=lines,
        games=sum(line.games for line in lines),
        wins=sum(line.wins for line in lines),
    )


def global_stats(db: Session) -> GlobalStats:
    lines = _lines(db, None)
    players = db.scalar(select(func.count()).select_from(Player)) or 0
    return GlobalStats(
        lines=lines,
        games=sum(line.games for line in lines),
        wins=sum(line.wins for line in lines),
        players=players,
    )


def leaderboard(db: Session, limit: int = 10) -> list[LeaderboardEntry]:
    """Joueurs inscrits classés par victoires puis par nombre de parties. Invités exclus."""
    games = func.count(Game.id)
    wins = func.count(Game.id).filter(Game.result == "win")
    query = (
        select(Player.username, games, wins)
        .join(Game, Game.player_id == Player.id)
        .where(Player.is_guest.is_(False), Game.status == "finished")
        .group_by(Player.id, Player.username)
        .order_by(wins.desc(), games.asc(), Player.username)
        .limit(limit)
    )
    return [
        LeaderboardEntry(username=username, games=g, wins=w, win_rate=_rate(w, g))
        for username, g, w in db.execute(query)
    ]
