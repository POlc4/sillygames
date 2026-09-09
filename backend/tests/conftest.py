"""Fixtures d'intégration : base de test dédiée, migrations Alembic, client HTTP.

La base `sillygames_test` est créée si besoin à côté de la base de dev, migrée avec
Alembic (ce qui valide les migrations), puis vidée après chaque test.
"""

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, make_url, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, get_settings
from app.db import get_db
from app.main import app

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _test_database_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    base = make_url(Settings().database_url)
    return base.set(database=f"{base.database}_test").render_as_string(hide_password=False)


def _ensure_database(url: str) -> None:
    target = make_url(url)
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
        )
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{target.database}"'))
    admin.dispose()


def _migrate(url: str) -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    return Settings(
        database_url=_test_database_url(),
        jwt_secret="test-secret-not-for-prod-test-secret-0001",
        cookie_secure=False,
    )


@pytest.fixture(scope="session")
def engine(test_settings: Settings) -> Iterator[Engine]:
    _ensure_database(test_settings.database_url)
    _migrate(test_settings.database_url)
    engine = create_engine(test_settings.database_url)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(engine: Engine) -> Iterator[Session]:
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        yield session
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE moves, games, players RESTART IDENTITY CASCADE"))


@pytest.fixture
def client(test_settings: Settings, db_session: Session) -> Iterator[TestClient]:
    def override_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_settings] = lambda: test_settings
    # Le limiteur de débit est désactivé par défaut : tous les tests partagent la même IP.
    # tests/test_ratelimit.py le réactive explicitement.
    app.state.limiter.enabled = False
    app.state.limiter.reset()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    app.state.limiter.enabled = True
