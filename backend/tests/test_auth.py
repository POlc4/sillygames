"""Tests d'intégration des routes /api/auth contre Postgres."""

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Player

COOKIE = "sg_session"
VALID = {"username": "alice_01", "password": "correct-horse-battery"}


def test_guest_creates_player_and_session(client: TestClient, db_session: Session) -> None:
    resp = client.post("/api/auth/guest")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_guest"] is True
    assert body["username"] is None
    assert COOKIE in resp.cookies

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["id"] == body["id"]
    assert db_session.scalar(select(func.count()).select_from(Player)) == 1


def test_guest_is_idempotent_for_existing_session(client: TestClient) -> None:
    first = client.post("/api/auth/guest").json()
    second = client.post("/api/auth/guest").json()
    assert first["id"] == second["id"]


def test_register_converts_guest_and_keeps_id(client: TestClient, db_session: Session) -> None:
    guest = client.post("/api/auth/guest").json()
    resp = client.post("/api/auth/register", json=VALID)
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == guest["id"]
    assert body["username"] == VALID["username"]
    assert body["is_guest"] is False
    assert db_session.scalar(select(func.count()).select_from(Player)) == 1

    row = db_session.get(Player, guest["id"])
    assert row is not None
    assert row.password_hash is not None
    assert VALID["password"] not in row.password_hash


def test_register_without_session_creates_player(client: TestClient) -> None:
    resp = client.post("/api/auth/register", json=VALID)
    assert resp.status_code == 201
    assert COOKIE in resp.cookies
    assert client.get("/api/auth/me").json()["username"] == VALID["username"]


def test_register_rejects_duplicate_username(client: TestClient) -> None:
    client.post("/api/auth/register", json=VALID)
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/register", json={**VALID, "password": "another-password"})
    assert resp.status_code == 409
    assert resp.json()["detail"] == "username already taken"


def test_register_rejects_already_registered_session(client: TestClient) -> None:
    client.post("/api/auth/register", json=VALID)
    resp = client.post(
        "/api/auth/register", json={"username": "bob_02", "password": "some-password"}
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "already registered"


def test_register_validates_input(client: TestClient) -> None:
    assert (
        client.post(
            "/api/auth/register", json={"username": "ab", "password": VALID["password"]}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/register", json={"username": "alice", "password": "short"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/auth/register", json={"username": "not valid!", "password": VALID["password"]}
        ).status_code
        == 422
    )


def test_login_success(client: TestClient) -> None:
    registered = client.post("/api/auth/register", json=VALID).json()
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    resp = client.post("/api/auth/login", json=VALID)
    assert resp.status_code == 200
    assert resp.json()["id"] == registered["id"]
    assert client.get("/api/auth/me").json()["id"] == registered["id"]


def test_login_wrong_password(client: TestClient) -> None:
    client.post("/api/auth/register", json=VALID)
    client.post("/api/auth/logout")
    resp = client.post("/api/auth/login", json={**VALID, "password": "wrong-password"})
    assert resp.status_code == 401
    assert COOKIE not in resp.cookies


def test_login_unknown_user(client: TestClient) -> None:
    resp = client.post("/api/auth/login", json={"username": "nobody", "password": "whatever-123"})
    assert resp.status_code == 401


def test_login_from_guest_switches_to_registered_account(client: TestClient) -> None:
    registered = client.post("/api/auth/register", json=VALID).json()
    client.post("/api/auth/logout")
    guest = client.post("/api/auth/guest").json()
    assert guest["id"] != registered["id"]
    client.post("/api/auth/login", json=VALID)
    assert client.get("/api/auth/me").json()["id"] == registered["id"]


def test_logout_clears_session(client: TestClient) -> None:
    client.post("/api/auth/guest")
    resp = client.post("/api/auth/logout")
    assert resp.status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_me_requires_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_garbage_cookie(client: TestClient) -> None:
    client.cookies.set(COOKIE, "not-a-jwt")
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_token_signed_with_other_secret(client: TestClient) -> None:
    import uuid

    from app.auth.security import create_token
    from app.config import Settings

    other = Settings(jwt_secret="another-secret-another-secret-another-0")
    client.cookies.set(COOKIE, create_token(uuid.uuid4(), other))
    assert client.get("/api/auth/me").status_code == 401


def test_session_cookie_is_httponly_and_lax(client: TestClient) -> None:
    resp = client.post("/api/auth/guest")
    header = resp.headers["set-cookie"].lower()
    assert "httponly" in header
    assert "samesite=lax" in header
    assert "secure" not in header  # cookie_secure=False en test/dev
