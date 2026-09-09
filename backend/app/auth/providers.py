"""Fournisseurs OAuth 2 / OpenID Connect supportés.

Le flux est Authorization Code + PKCE, puis lecture du profil via l'endpoint userinfo avec le
jeton d'accès (échange serveur à serveur avec le secret client, donc profil digne de confiance).
Un fournisseur est actif seulement si son client_id et son secret sont configurés.
"""

from dataclasses import dataclass
from typing import Any

from app.config import Settings


@dataclass(frozen=True)
class Provider:
    name: str
    label: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scopes: str
    client_id: str
    client_secret: str

    def redirect_uri(self, public_url: str) -> str:
        return f"{public_url.rstrip('/')}/api/auth/oauth/{self.name}/callback"


@dataclass(frozen=True)
class Profile:
    subject: str
    email: str | None
    display_name: str | None


_CATALOG: dict[str, dict[str, str]] = {
    "github": {
        "label": "GitHub",
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scopes": "read:user user:email",
    },
    "google": {
        "label": "Google",
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "scopes": "openid email profile",
    },
    "microsoft": {
        "label": "Microsoft",
        "authorize_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "userinfo_url": "https://graph.microsoft.com/oidc/userinfo",
        "scopes": "openid email profile",
    },
    "facebook": {
        "label": "Facebook",
        "authorize_url": "https://www.facebook.com/v19.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v19.0/oauth/access_token",
        "userinfo_url": "https://graph.facebook.com/me?fields=id,name,email",
        "scopes": "public_profile email",
    },
}


def enabled_providers(settings: Settings) -> dict[str, Provider]:
    providers: dict[str, Provider] = {}
    for name, spec in _CATALOG.items():
        client_id = getattr(settings, f"oauth_{name}_client_id")
        client_secret = getattr(settings, f"oauth_{name}_client_secret")
        if client_id and client_secret:
            providers[name] = Provider(
                name=name, client_id=client_id, client_secret=client_secret, **spec
            )
    return providers


def parse_profile(provider: str, data: dict[str, Any]) -> Profile:
    """Normalise la réponse userinfo de chaque fournisseur (identifiant stable, e-mail, nom)."""
    if provider == "github":
        return Profile(
            subject=str(data["id"]), email=data.get("email"), display_name=data.get("login")
        )
    if provider == "facebook":
        return Profile(
            subject=str(data["id"]), email=data.get("email"), display_name=data.get("name")
        )
    # Google et Microsoft : OpenID Connect standard.
    return Profile(
        subject=str(data["sub"]),
        email=data.get("email"),
        display_name=data.get("name") or data.get("preferred_username"),
    )
