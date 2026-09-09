"""Statistiques : personnelles, globales, classement."""

from fastapi import APIRouter

from app.auth.deps import CurrentPlayer, DbSession
from app.schemas import GlobalStats, LeaderboardEntry, PlayerStats
from app.services import stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/me", response_model=PlayerStats)
def my_stats(player: CurrentPlayer, db: DbSession) -> PlayerStats:
    return stats.player_stats(db, player.id)


@router.get("/global", response_model=GlobalStats)
def global_stats(db: DbSession) -> GlobalStats:
    return stats.global_stats(db)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(db: DbSession) -> list[LeaderboardEntry]:
    return stats.leaderboard(db)
