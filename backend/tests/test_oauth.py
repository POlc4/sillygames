"""Connexion OAuth contre des fournisseurs simulés (httpx.MockTransport). Aucun appel réseau."""

from collections.abc import Iterator
from typing import Any, ClassVar
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import oauth
from app.config import Settings, get_settings
from app.deps import get_http_client
from app.main import app

FLOW = oauth.FLOW_COOKIE
SESSION = "sg_session"


class FakeProvider:
    """Simule token + userinfo (+ e-mails GitHub). Enregistre les requêtes reçues."""

    DEFAULTS: ClassVar[dict[str, dict[str, Any]]] = {
        "github": {"id": 42, "login": "octocat", "email": "octo@example.com"},
        "google": {"sub": "g-42", "name": "Octo Cat", "email": "octo@gmail.example"},
    }

    def __init__(self) -> None:
        # Profil explicite d'un test, sinon celui par défaut du fournisseur interrogé.
        self.profile: dict[str, Any] | None = None
        self.emails: list[dict[str, Any]] = []
        self.token_status = 200
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if path.endswith("/access_token") or path.endswith("/token"):
            if self.token_status != 200:
                return httpx.Response(self.token_status, json={"error": "bad_verification_code"})
            return httpx.Response(200, json={"access_token": "tok-123", "token_type": "bearer"})
        if path == "/user/emails":
            return httpx.Response(200, json=self.emails)
        if request.headers.get("Authorization") != "Bearer tok-123":
            return httpx.Response(401, json={"error": "unauthorized"})
        which = "google" if "googleapis" in request.url.host else "github"
        return httpx.Response(200, json=self.profile or self.DEFAULTS[which])


@pytest.fixture
def provider(client: TestClient, test_settings: Settings) -> Iterator[FakeProvider]:
    settings = test_settings.model_copy(
        update={
            "oauth_github_client_id": "gh-id",
            "oauth_github_client_secret": "gh-secret",
            "oauth_google_client_id": "g-id",
            "oauth_google_client_secret": "g-secret",
        }
    )
    fake = FakeProvider()

    def http_client() -> Iterator[httpx.Client]:
        with httpx.Client(transport=httpx.MockTransport(fake.handler)) as c:
            yield c

    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_http_client] = http_client
    yield fake


def start(client: TestClient, name: str = "github", **params: str) -> httpx.Response:
    return client.get(f"/api/auth/oauth/{name}/start", params=params, follow_redirects=False)


def complete(client: TestClient, name: str = "github", **params: str) -> httpx.Response:
    """Départ puis retour avec le bon state, comme le ferait le navigateur."""
    started = start(client, name, **params)
    assert started.status_code == 302
    state = parse_qs(urlparse(started.headers["location"]).query)["state"][0]
    return client.get(
        f"/api/auth/oauth/{name}/callback",
        params={"code": "code-abc", "state": state},
        follow_redirects=False,
    )


def test_providers_lists_only_configured_ones(client: TestClient, provider: FakeProvider) -> None:
    names = [p["name"] for p in client.get("/api/auth/providers").json()]
    assert names == ["github", "google"]


def test_providers_is_empty_without_configuration(client: TestClient) -> None:
    assert client.get("/api/auth/providers").json() == []
    assert start(client, "github").status_code == 404


def test_start_redirects_with_pkce_and_flow_cookie(
    client: TestClient, provider: FakeProvider
) -> None:
    resp = start(client, "github", return_to="/stats")
    assert resp.status_code == 302
    url = urlparse(resp.headers["location"])
    assert url.netloc == "github.com"
    query = parse_qs(url.query)
    assert query["client_id"] == ["gh-id"]
    assert query["redirect_uri"] == ["http://localhost:3000/api/auth/oauth/github/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert len(query["state"][0]) > 20
    assert FLOW in resp.cookies
    assert "httponly" in resp.headers["set-cookie"].lower()


def test_guest_is_converted_and_keeps_its_id(client: TestClient, provider: FakeProvider) -> None:
    guest = client.post("/api/auth/guest").json()
    resp = complete(client, "github", return_to="/stats")
    assert resp.status_code == 302
    assert resp.headers["location"] == "/stats"

    me = client.get("/api/auth/me").json()
    assert me["id"] == guest["id"]
    assert me["is_guest"] is False
    assert me["username"] == "octocat"
    identities = client.get("/api/auth/identities").json()
    assert [(i["provider"], i["email"]) for i in identities] == [("github", "octo@example.com")]

    # Le code et le verifier PKCE ont bien été envoyés au fournisseur.
    token_request = next(r for r in provider.requests if r.url.path.endswith("/access_token"))
    body = parse_qs(token_request.content.decode())
    assert body["code"] == ["code-abc"]
    assert body["client_secret"] == ["gh-secret"]
    assert len(body["code_verifier"][0]) > 40


def test_known_identity_logs_in_its_player(client: TestClient, provider: FakeProvider) -> None:
    complete(client, "github")
    owner = client.get("/api/auth/me").json()
    client.post("/api/auth/logout")

    guest = client.post("/api/auth/guest").json()
    assert guest["id"] != owner["id"]
    complete(client, "github")
    assert client.get("/api/auth/me").json()["id"] == owner["id"]
    assert len(client.get("/api/auth/identities").json()) == 1


def test_registered_player_links_identity(client: TestClient, provider: FakeProvider) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "bob-password-1"})
    complete(client, "google")
    me = client.get("/api/auth/me").json()
    assert me["username"] == "bob"
    assert [i["provider"] for i in client.get("/api/auth/identities").json()] == ["google"]


def test_state_mismatch_is_rejected(client: TestClient, provider: FakeProvider) -> None:
    start(client, "github")
    resp = client.get(
        "/api/auth/oauth/github/callback",
        params={"code": "x", "state": "forged"},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    assert resp.headers["location"].startswith("/login?error=oauth")
    assert SESSION not in resp.cookies
    assert client.get("/api/auth/me").status_code == 401


def test_callback_without_flow_cookie_is_rejected(
    client: TestClient, provider: FakeProvider
) -> None:
    resp = client.get(
        "/api/auth/oauth/github/callback",
        params={"code": "x", "state": "y"},
        follow_redirects=False,
    )
    assert resp.headers["location"].startswith("/login?error=oauth")


def test_provider_denial_is_reported(client: TestClient, provider: FakeProvider) -> None:
    started = start(client, "github")
    state = parse_qs(urlparse(started.headers["location"]).query)["state"][0]
    resp = client.get(
        "/api/auth/oauth/github/callback",
        params={"error": "access_denied", "state": state},
        follow_redirects=False,
    )
    assert "access_denied" in resp.headers["location"]


def test_failed_token_exchange_creates_nothing(client: TestClient, provider: FakeProvider) -> None:
    provider.token_status = 400
    resp = complete(client, "github")
    assert resp.headers["location"].startswith("/login?error=oauth")
    assert client.get("/api/auth/me").status_code == 401


def test_github_email_falls_back_to_the_emails_endpoint(
    client: TestClient, provider: FakeProvider
) -> None:
    provider.profile = {"id": 7, "login": "hidden", "email": None}
    provider.emails = [
        {"email": "secondary@example.com", "primary": False, "verified": True},
        {"email": "primary@example.com", "primary": True, "verified": True},
    ]
    complete(client, "github")
    assert client.get("/api/auth/identities").json()[0]["email"] == "primary@example.com"


def test_google_profile_uses_sub_and_name(client: TestClient, provider: FakeProvider) -> None:
    provider.profile = {"sub": "1234567890", "name": "Alice Martin", "email": "alice@example.com"}
    complete(client, "google")
    me = client.get("/api/auth/me").json()
    assert me["username"] == "AliceMartin"


def test_username_collisions_get_a_suffix(client: TestClient, provider: FakeProvider) -> None:
    client.post("/api/auth/register", json={"username": "octocat", "password": "octo-password"})
    client.post("/api/auth/logout")
    complete(client, "github")
    username = client.get("/api/auth/me").json()["username"]
    assert username.startswith("octocat_") and username != "octocat"


def test_return_to_must_be_a_relative_path(client: TestClient, provider: FakeProvider) -> None:
    resp = complete(client, "github", return_to="https://evil.example/phish")
    assert resp.headers["location"] == "/"


def test_unlink_rules(client: TestClient, provider: FakeProvider) -> None:
    complete(client, "github")
    only = client.get("/api/auth/identities").json()[0]["id"]
    assert client.delete(f"/api/auth/identities/{only}").status_code == 409

    complete(client, "google")
    ids = {i["provider"]: i["id"] for i in client.get("/api/auth/identities").json()}
    assert client.delete(f"/api/auth/identities/{ids['google']}").status_code == 204
    assert [i["provider"] for i in client.get("/api/auth/identities").json()] == ["github"]
    assert client.delete(f"/api/auth/identities/{ids['google']}").status_code == 404


def test_identities_require_session(client: TestClient) -> None:
    assert client.get("/api/auth/identities").status_code == 401
