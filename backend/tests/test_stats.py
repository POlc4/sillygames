"""Tests d'intégration des routes /api/stats."""

import random
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.deps import get_rng
from app.games.sticks import winning_move
from app.main import app


@pytest.fixture(autouse=True)
def seeded_rng() -> None:
    app.dependency_overrides[get_rng] = lambda: random.Random(7)


def play_sticks(client: TestClient, *, win: bool) -> None:
    """Victoire garantie sur 22 en jouant parfaitement, défaite garantie face à perfect sur 21."""
    if win:
        body: dict[str, Any] = {"game_type": "sticks", "config": {"sticks": 22}}
    else:
        body = {"game_type": "sticks", "ai_strategy": "perfect", "config": {"sticks": 21}}
    game = client.post("/api/games", json=body).json()
    while game["status"] == "in_progress":
        take = (winning_move(game["state"]["sticks"]) or 1) if win else 1
        game = client.post(f"/api/games/{game['id']}/moves", json={"move": take}).json()
    assert game["result"] == ("win" if win else "loss")


def test_stats_require_session_for_me_only(client: TestClient) -> None:
    assert client.get("/api/stats/me").status_code == 401
    assert client.get("/api/stats/global").status_code == 200
    assert client.get("/api/stats/leaderboard").status_code == 200


def test_empty_stats(client: TestClient) -> None:
    client.post("/api/auth/guest")
    assert client.get("/api/stats/me").json() == {"lines": [], "games": 0, "wins": 0}
    assert client.get("/api/stats/global").json() == {
        "lines": [],
        "games": 0,
        "wins": 0,
        "players": 1,
    }
    assert client.get("/api/stats/leaderboard").json() == []


def test_my_stats_only_count_finished_games_by_strategy(client: TestClient) -> None:
    client.post("/api/auth/guest")
    play_sticks(client, win=True)
    play_sticks(client, win=True)
    play_sticks(client, win=False)
    client.post("/api/games", json={"game_type": "rps"})  # en cours : ignorée

    stats = client.get("/api/stats/me").json()
    assert stats["games"] == 3
    assert stats["wins"] == 2
    by_strategy = {line["ai_strategy"]: line for line in stats["lines"]}
    assert by_strategy["random"] == {
        "game_type": "sticks",
        "ai_strategy": "random",
        "games": 2,
        "wins": 2,
        "losses": 0,
        "draws": 0,
        "win_rate": 1.0,
    }
    assert by_strategy["perfect"]["losses"] == 1
    assert by_strategy["perfect"]["win_rate"] == 0.0


def test_global_stats_aggregate_all_players(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "alice", "password": "alice-password"})
    play_sticks(client, win=True)
    client.post("/api/auth/logout")
    client.post("/api/auth/guest")
    play_sticks(client, win=False)

    stats = client.get("/api/stats/global").json()
    assert stats["players"] == 2
    assert stats["games"] == 2
    assert stats["wins"] == 1
    assert client.get("/api/stats/me").json()["games"] == 1


def test_leaderboard_ranks_registered_players_only(client: TestClient) -> None:
    client.post("/api/auth/register", json={"username": "bob", "password": "bob-password-1"})
    play_sticks(client, win=True)
    play_sticks(client, win=False)
    client.post("/api/auth/logout")

    client.post("/api/auth/register", json={"username": "carol", "password": "carol-password"})
    play_sticks(client, win=True)
    play_sticks(client, win=True)
    client.post("/api/auth/logout")

    client.post("/api/auth/guest")
    play_sticks(client, win=True)
    play_sticks(client, win=True)
    play_sticks(client, win=True)

    board = client.get("/api/stats/leaderboard").json()
    assert board == [
        {"username": "carol", "games": 2, "wins": 2, "win_rate": 1.0},
        {"username": "bob", "games": 2, "wins": 1, "win_rate": 0.5},
    ]
