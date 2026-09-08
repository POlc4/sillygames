"""Connexion SQLAlchemy : moteur créé paresseusement à partir de la configuration."""

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def engine_for(url: str) -> Engine:
    return create_engine(url, pool_pre_ping=True)


def get_db() -> Iterator[Session]:
    factory = sessionmaker(bind=engine_for(get_settings().database_url), expire_on_commit=False)
    with factory() as session:
        yield session
