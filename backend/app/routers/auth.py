"""Authentification : invité, inscription (conversion de l'invité), connexion, déconnexion."""

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.auth.deps import (
    AppSettings,
    CurrentPlayer,
    DbSession,
    OptionalPlayer,
    clear_session_cookie,
    set_session_cookie,
)
from app.auth.security import hash_password, verify_password
from app.models import Player
from app.schemas import LoginIn, PlayerOut, RegisterIn

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/guest", response_model=PlayerOut)
def guest(
    response: Response, db: DbSession, settings: AppSettings, player: OptionalPlayer
) -> Player:
    """Crée un joueur invité et ouvre la session. Idempotent si une session existe déjà."""
    if player is not None:
        return player
    new_player = Player(is_guest=True)
    db.add(new_player)
    db.commit()
    db.refresh(new_player)
    set_session_cookie(response, new_player.id, settings)
    return new_player


@router.post("/register", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterIn,
    response: Response,
    db: DbSession,
    settings: AppSettings,
    player: OptionalPlayer,
) -> Player:
    """Inscrit un joueur.

    Si la session courante est un invité, il est converti : son historique est conservé.
    """
    if player is not None and not player.is_guest:
        raise HTTPException(status.HTTP_409_CONFLICT, "already registered")
    taken = db.scalar(select(Player.id).where(Player.username == body.username))
    if taken is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "username already taken")

    if player is None:
        player = Player()
        db.add(player)
    player.username = body.username
    player.password_hash = hash_password(body.password)
    player.is_guest = False
    db.commit()
    db.refresh(player)
    set_session_cookie(response, player.id, settings)
    return player


@router.post("/login", response_model=PlayerOut)
def login(body: LoginIn, response: Response, db: DbSession, settings: AppSettings) -> Player:
    player = db.scalar(select(Player).where(Player.username == body.username))
    if player is None or player.password_hash is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    if not verify_password(body.password, player.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    set_session_cookie(response, player.id, settings)
    return player


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(settings: AppSettings) -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_session_cookie(response, settings)
    return response


@router.get("/me", response_model=PlayerOut)
def me(player: CurrentPlayer) -> Player:
    return player
