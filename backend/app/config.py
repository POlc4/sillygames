"""Configuration lue depuis l'environnement (et un fichier .env en dev)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://sillygames:sillygames@localhost:5432/sillygames"
    jwt_secret: str = "dev-only-change-me-dev-only-change-me-000"
    jwt_ttl_days: int = 30
    cookie_name: str = "sg_session"
    # True en production (HTTPS derrière Caddy).
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
