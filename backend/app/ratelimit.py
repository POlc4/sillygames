"""Limitation de débit par adresse IP (slowapi). Derrière Caddy, uvicorn tourne avec
--proxy-headers : request.client.host est l'adresse réelle du visiteur."""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

limiter = Limiter(key_func=get_remote_address, headers_enabled=True)


def auth_limit() -> str:
    """Lu à chaque requête, donc surchargeable par la configuration et les tests."""
    return get_settings().auth_rate_limit
