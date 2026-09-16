import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings


def test_health_reports_database(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "ok"}


def test_openapi_is_served_under_api_prefix(client: TestClient) -> None:
    resp = client.get("/api/openapi.json")
    assert resp.status_code == 200
    assert "/api/auth/guest" in resp.json()["paths"]


def test_openapi_reports_the_configured_version(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """La version vient d'APP_VERSION (injectée dans l'image), jamais d'une constante du code."""
    assert client.get("/api/openapi.json").json()["info"]["version"] == get_settings().app_version
    monkeypatch.setenv("APP_VERSION", "9.9.9")
    get_settings.cache_clear()
    try:
        assert Settings().app_version == "9.9.9"
    finally:
        get_settings.cache_clear()
