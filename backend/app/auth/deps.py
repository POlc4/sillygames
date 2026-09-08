"""Dépendances FastAPI : joueur courant (invité ou inscrit) via le cookie de session."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth.security import create_token, decode_token
from app.config import Settings, get_settings
from app.db import get_db
from app.models import Player

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]


def get_optional_player(request: Request, db: DbSession, settings: AppSettings) -> Player | None:
    token = request.cookies.get(settings.cookie_name)
    if not token:
        return None
    player_id = decode_token(token, settings)
    if player_id is None:
        return None
    return db.get(Player, player_id)


OptionalPlayer = Annotated[Player | None, Depends(get_optional_player)]


def get_current_player(player: OptionalPlayer) -> Player:
    if player is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "not authenticated")
    return player


CurrentPlayer = Annotated[Player, Depends(get_current_player)]


def set_session_cookie(response: Response, player_id: uuid.UUID, settings: Settings) -> None:
    response.set_cookie(
        key=settings.cookie_name,
        value=create_token(player_id, settings),
        max_age=settings.jwt_ttl_days * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.cookie_name,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )
