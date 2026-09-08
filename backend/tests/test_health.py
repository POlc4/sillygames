from fastapi.testclient import TestClient


def test_health_reports_database(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "ok"}


def test_openapi_is_served_under_api_prefix(client: TestClient) -> None:
    resp = client.get("/api/openapi.json")
    assert resp.status_code == 200
    assert "/api/auth/guest" in resp.json()["paths"]
