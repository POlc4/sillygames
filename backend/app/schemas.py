"""Schémas d'entrée/sortie de l'API."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr

USERNAME_PATTERN = r"^[A-Za-z0-9_.-]+$"


class PlayerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str | None
    is_guest: bool
    created_at: datetime


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_PATTERN)
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    username: str = Field(max_length=32)
    password: str = Field(max_length=128)


class ProviderOut(BaseModel):
    name: str
    label: str


class IdentityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    provider: str
    email: str | None
    display_name: str | None
    created_at: datetime


# --- Jeux ---------------------------------------------------------------------

GameType = Literal["sticks", "rps"]
FirstPlayer = Literal["player", "ai", "random"]


class SticksConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sticks: int = Field(default=21, ge=5, le=50)
    first: FirstPlayer = "player"


class RpsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rounds: int = Field(default=5, ge=1, le=20)


class GameCreate(BaseModel):
    game_type: GameType
    ai_strategy: str = Field(default="random", max_length=16)
    config: dict[str, Any] = Field(default_factory=dict)


class MoveIn(BaseModel):
    # Bâtonnets : nombre à retirer (1-3). Pierre-feuille-ciseaux : "rock" | "paper" | "scissors".
    # Types stricts : refusent les conversions implicites (true -> 1, "2" -> 2).
    move: StrictInt | StrictStr


class ImportTurn(BaseModel):
    player_move: StrictInt | StrictStr | None = None
    ai_move: StrictInt | StrictStr | None = None


class GameImport(BaseModel):
    """Partie jouée hors ligne (PWA), rejouée par le serveur avant d'être enregistrée."""

    game_type: GameType
    ai_strategy: str = Field(default="random", max_length=16)
    config: dict[str, Any] = Field(default_factory=dict)
    turns: list[ImportTurn] = Field(min_length=1, max_length=100)
    started_at: datetime | None = None
    finished_at: datetime | None = None


class MoveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    turn: int
    player_move: str | None
    ai_move: str | None
    state_before: dict[str, Any]
    state_after: dict[str, Any]
    created_at: datetime


class GameSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    game_type: str
    ai_strategy: str
    config: dict[str, Any]
    status: str
    result: str | None
    started_at: datetime
    finished_at: datetime | None


class GameOut(GameSummary):
    state: dict[str, Any]
    moves: list[MoveOut]


# --- Statistiques -------------------------------------------------------------


class StatLine(BaseModel):
    game_type: str
    ai_strategy: str
    games: int
    wins: int
    losses: int
    draws: int
    win_rate: float


class PlayerStats(BaseModel):
    lines: list[StatLine]
    games: int
    wins: int


class GlobalStats(PlayerStats):
    players: int


class LeaderboardEntry(BaseModel):
    username: str
    games: int
    wins: int
    win_rate: float
