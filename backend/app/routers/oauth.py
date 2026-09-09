"""Connexion par un fournisseur externe et gestion des identités liées."""

import uuid

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.auth import oauth
from app.auth.deps import (
    AppSettings,
    CurrentPlayer,
    DbSession,
    OptionalPlayer,
    set_session_cookie,
)
from app.auth.providers import Provider, enabled_providers
from app.config import Settings
from app.deps import HttpClient
from app.models import Identity
from app.schemas import IdentityOut, ProviderOut

router = APIRouter(prefix="/auth", tags=["oauth"])


def _provider(name: str, settings: Settings) -> Provider:
    provider = enabled_providers(settings).get(name)
    if provider is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown or disabled provider")
    return provider


@router.get("/providers", response_model=list[ProviderOut])
def list_providers(settings: AppSettings) -> list[ProviderOut]:
    return [ProviderOut(name=p.name, label=p.label) for p in enabled_providers(settings).values()]


@router.get("/oauth/{name}/start")
def start(name: str, settings: AppSettings, return_to: str | None = None) -> RedirectResponse:
    provider = _provider(name, settings)
    url, cookie = oauth.begin(provider, settings, return_to)
    response = RedirectResponse(url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        oauth.FLOW_COOKIE,
        cookie,
        max_age=int(oauth.FLOW_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/api/auth/oauth",
    )
    return response


@router.get("/oauth/{name}/callback")
def callback(
    name: str,
    request: Request,
    settings: AppSettings,
    db: DbSession,
    http: HttpClient,
    player: OptionalPlayer,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    provider = _provider(name, settings)
    try:
        if error or not code or not state:
            raise oauth.OAuthError(error or "missing code or state")
        flow = oauth.read_flow(request.cookies.get(oauth.FLOW_COOKIE), settings, name, state)
        profile = oauth.fetch_profile(http, provider, settings, code, flow)
    except oauth.OAuthError as exc:
        response = RedirectResponse(f"/login?error=oauth&reason={exc}", status_code=302)
        response.delete_cookie(oauth.FLOW_COOKIE, path="/api/auth/oauth")
        return response

    target = oauth.attach(db, name, profile, player)
    response = RedirectResponse(flow.return_to, status_code=status.HTTP_302_FOUND)
    response.delete_cookie(oauth.FLOW_COOKIE, path="/api/auth/oauth")
    set_session_cookie(response, target.id, settings)
    return response


@router.get("/identities", response_model=list[IdentityOut])
def list_identities(player: CurrentPlayer, db: DbSession) -> list[Identity]:
    return list(
        db.scalars(
            select(Identity).where(Identity.player_id == player.id).order_by(Identity.created_at)
        )
    )


@router.delete("/identities/{identity_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink(identity_id: uuid.UUID, player: CurrentPlayer, db: DbSession) -> None:
    identity = next((i for i in player.identities if i.id == identity_id), None)
    if identity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "identity not found")
    if player.password_hash is None and len(player.identities) == 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "cannot remove the only way to sign in to this account"
        )
    db.delete(identity)
    db.commit()
    db.refresh(player)
