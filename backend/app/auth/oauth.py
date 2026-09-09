"""Flux OAuth : départ (state + PKCE dans un cookie signé), retour (échange du code, profil),
puis rattachement de l'identité au joueur selon docs/adr/0003 et docs/plan.md (étape 2 bis)."""

import base64
import hashlib
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.providers import Profile, Provider, parse_profile
from app.config import Settings
from app.models import Identity, Player

FLOW_COOKIE = "sg_oauth"
FLOW_TTL = timedelta(minutes=10)


class OAuthError(Exception):
    """Erreur du flux (state invalide, refus du fournisseur, échange raté)."""


@dataclass(frozen=True)
class FlowState:
    provider: str
    state: str
    code_verifier: str
    return_to: str


def safe_return_to(value: str | None) -> str:
    """N'accepte qu'un chemin relatif du site (pas d'open redirect)."""
    if value and value.startswith("/") and not value.startswith("//"):
        return value
    return "/"


def _pkce_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def begin(provider: Provider, settings: Settings, return_to: str | None) -> tuple[str, str]:
    """Renvoie (URL d'autorisation, cookie de flux signé)."""
    flow = FlowState(
        provider=provider.name,
        state=secrets.token_urlsafe(32),
        code_verifier=secrets.token_urlsafe(64),
        return_to=safe_return_to(return_to),
    )
    params = {
        "client_id": provider.client_id,
        "redirect_uri": provider.redirect_uri(settings.public_url),
        "response_type": "code",
        "scope": provider.scopes,
        "state": flow.state,
        "code_challenge": _pkce_challenge(flow.code_verifier),
        "code_challenge_method": "S256",
    }
    payload = {
        **flow.__dict__,
        "exp": datetime.now(UTC) + FLOW_TTL,
    }
    cookie = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")
    return f"{provider.authorize_url}?{urlencode(params)}", cookie


def read_flow(cookie: str | None, settings: Settings, provider_name: str, state: str) -> FlowState:
    if not cookie:
        raise OAuthError("missing flow cookie")
    try:
        data = jwt.decode(cookie, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise OAuthError("invalid or expired flow cookie") from exc
    flow = FlowState(
        provider=str(data["provider"]),
        state=str(data["state"]),
        code_verifier=str(data["code_verifier"]),
        return_to=safe_return_to(str(data.get("return_to", "/"))),
    )
    if flow.provider != provider_name or not secrets.compare_digest(flow.state, state):
        raise OAuthError("state mismatch")
    return flow


def fetch_profile(
    client: httpx.Client, provider: Provider, settings: Settings, code: str, flow: FlowState
) -> Profile:
    """Échange le code contre un jeton d'accès, puis lit le profil."""
    token_resp = client.post(
        provider.token_url,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": provider.redirect_uri(settings.public_url),
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code_verifier": flow.code_verifier,
        },
        headers={"Accept": "application/json"},
    )
    if token_resp.status_code != 200:
        raise OAuthError(f"token exchange failed ({token_resp.status_code})")
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise OAuthError("no access token in provider response")

    info_resp = client.get(
        provider.userinfo_url,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
    )
    if info_resp.status_code != 200:
        raise OAuthError(f"userinfo failed ({info_resp.status_code})")
    data = info_resp.json()

    # GitHub ne renvoie l'e-mail que s'il est public : on interroge la liste des e-mails.
    if provider.name == "github" and not data.get("email"):
        emails = client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        )
        if emails.status_code == 200:
            primary = next(
                (e for e in emails.json() if e.get("primary") and e.get("verified")), None
            )
            if primary:
                data["email"] = primary["email"]
    return parse_profile(provider.name, data)


_HANDLE_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def unique_username(db: Session, profile: Profile) -> str:
    """Pseudo dérivé du profil (nom d'affichage ou partie locale de l'e-mail), unique en base."""
    base = profile.display_name or (profile.email or "").split("@")[0] or "joueur"
    base = _HANDLE_RE.sub("", base)[:24] or "joueur"
    if len(base) < 3:
        base = f"{base}_{secrets.token_hex(2)}"
    candidate = base
    while db.scalar(select(Player.id).where(Player.username == candidate)) is not None:
        candidate = f"{base[:24]}_{secrets.token_hex(2)}"
    return candidate


def attach(db: Session, provider: str, profile: Profile, current: Player | None) -> Player:
    """Rattache l'identité et renvoie le joueur à connecter.

    - identité connue : on connecte son joueur (même si une autre session était ouverte) ;
    - session invitée : l'invité est converti, son historique est conservé ;
    - session inscrite : l'identité est liée au compte courant ;
    - aucune session : un nouveau joueur inscrit est créé.
    """
    existing = db.scalar(
        select(Identity).where(
            Identity.provider == provider, Identity.provider_subject == profile.subject
        )
    )
    if existing is not None:
        existing.email = profile.email or existing.email
        existing.display_name = profile.display_name or existing.display_name
        db.commit()
        return existing.player

    player = current if current is not None else Player()
    if current is None:
        db.add(player)
    if player.is_guest or player.username is None:
        player.username = unique_username(db, profile)
        player.is_guest = False
    player.identities.append(
        Identity(
            provider=provider,
            provider_subject=profile.subject,
            email=profile.email,
            display_name=profile.display_name,
        )
    )
    db.commit()
    db.refresh(player)
    return player
