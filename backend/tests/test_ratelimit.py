"""Limitation de débit sur les routes d'authentification."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app


@pytest.fixture
def strict_limit(
    client: TestClient, test_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> Iterator[TestClient]:
    strict = test_settings.model_copy(update={"auth_rate_limit": "3/minute"})
    app.dependency_overrides[get_settings] = lambda: strict
    # auth_limit() lit la configuration au moment de la requête, hors injection FastAPI.
    monkeypatch.setattr("app.ratelimit.get_settings", lambda: strict)
    app.state.limiter.reset()
    app.state.limiter.enabled = True
    yield client
    app.state.limiter.enabled = False


def test_login_is_rate_limited_per_ip(strict_limit: TestClient) -> None:
    body = {"username": "nobody", "password": "whatever-123"}
    for _ in range(3):
        assert strict_limit.post("/api/auth/login", json=body).status_code == 401
    blocked = strict_limit.post("/api/auth/login", json=body)
    assert blocked.status_code == 429
    assert "3 per 1 minute" in blocked.json()["error"]
    assert blocked.headers["retry-after"]


def test_each_auth_route_has_its_own_counter(strict_limit: TestClient) -> None:
    # Les 422 (validation avant la route) ne comptent pas : on envoie des corps valides.
    body = {"username": "user_x", "password": "correct-horse-battery"}
    assert strict_limit.post("/api/auth/register", json=body).status_code == 201
    for _ in range(2):
        assert strict_limit.post("/api/auth/register", json=body).status_code == 409
    assert strict_limit.post("/api/auth/register", json=body).status_code == 429
    # guest et me ne sont pas affectés par le compteur de register.
    assert strict_limit.post("/api/auth/guest").status_code == 200
    assert strict_limit.get("/api/auth/me").status_code == 200


def test_limit_headers_are_exposed(strict_limit: TestClient) -> None:
    resp = strict_limit.post("/api/auth/guest")
    assert resp.status_code == 200
    assert resp.headers["x-ratelimit-limit"] == "3"
    assert resp.headers["x-ratelimit-remaining"] == "2"


def test_limiter_is_disabled_in_the_other_tests(client: TestClient) -> None:
    for _ in range(15):
        assert (
            client.post("/api/auth/login", json={"username": "a", "password": "b"}).status_code
            == 401
        )
