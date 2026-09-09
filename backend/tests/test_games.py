"""Tests d'intégration des routes /api/games."""

import random
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.deps import get_rng
from app.games.sticks import winning_move
from app.main import app


@pytest.fixture(autouse=True)
def seeded_rng() -> None:
    app.dependency_overrides[get_rng] = lambda: random.Random(1234)


def new_game(client: TestClient, **body: Any) -> dict[str, Any]:
    resp = client.post("/api/games", json=body)
    assert resp.status_code == 201, resp.text
    return resp.json()  # type: ignore[no-any-return]


def move(client: TestClient, game_id: str, value: int | str) -> Any:
    return client.post(f"/api/games/{game_id}/moves", json={"move": value})


def test_requires_session(client: TestClient) -> None:
    assert client.post("/api/games", json={"game_type": "sticks"}).status_code == 401
    assert client.get("/api/games").status_code == 401


def test_create_sticks_game_with_defaults(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks")
    assert game["ai_strategy"] == "random"
    assert game["config"] == {"sticks": 21, "first": "player"}
    assert game["status"] == "in_progress"
    assert game["result"] is None
    assert game["state"]["sticks"] == 21
    assert game["state"]["legal_moves"] == [1, 2, 3]
    assert game["moves"] == []


def test_create_sticks_game_where_ai_opens(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(
        client, game_type="sticks", ai_strategy="perfect", config={"sticks": 22, "first": "ai"}
    )
    assert len(game["moves"]) == 1
    opening = game["moves"][0]
    assert opening["turn"] == 0
    assert opening["player_move"] is None
    assert opening["ai_move"] == "1"  # 22 -> 21 = 4k+1
    assert game["state"]["sticks"] == 21
    assert game["state"]["current"] == "player"


def test_random_first_is_resolved_in_config(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks", config={"first": "random"})
    assert game["config"]["first"] in {"player", "ai"}


@pytest.mark.parametrize(
    "body",
    [
        {"game_type": "chess"},
        {"game_type": "sticks", "ai_strategy": "ml"},
        {"game_type": "rps", "ai_strategy": "perfect"},
        {"game_type": "sticks", "config": {"sticks": 4}},
        {"game_type": "sticks", "config": {"unknown": 1}},
        {"game_type": "rps", "config": {"rounds": 0}},
    ],
)
def test_create_rejects_invalid_requests(client: TestClient, body: dict[str, Any]) -> None:
    client.post("/api/auth/guest")
    assert client.post("/api/games", json=body).status_code == 422


def test_player_playing_perfectly_beats_random_ai(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks", config={"sticks": 22, "first": "player"})
    turns = 0
    while game["status"] == "in_progress":
        take = winning_move(game["state"]["sticks"]) or 1
        resp = move(client, game["id"], take)
        assert resp.status_code == 200, resp.text
        game = resp.json()
        turns += 1
    assert game["result"] == "win"
    assert game["state"]["winner"] == "player"
    assert game["finished_at"] is not None
    assert len(game["moves"]) == turns
    assert [m["turn"] for m in game["moves"]] == list(range(1, turns + 1))


def test_perfect_ai_always_beats_player_on_21(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks", ai_strategy="perfect", config={"sticks": 21})
    while game["status"] == "in_progress":
        resp = move(client, game["id"], game["state"]["legal_moves"][-1])
        assert resp.status_code == 200, resp.text
        game = resp.json()
    assert game["result"] == "loss"


def test_rps_full_game(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="rps", config={"rounds": 3})
    for value in ["rock", "paper", "scissors"]:
        resp = move(client, game["id"], value)
        assert resp.status_code == 200, resp.text
        game = resp.json()
    assert game["status"] == "finished"
    assert game["result"] in {"win", "loss", "draw"}
    rounds = game["state"]["rounds"]
    assert [r["player"] for r in rounds] == ["rock", "paper", "scissors"]
    wins = sum(r["outcome"] == "win" for r in rounds)
    losses = sum(r["outcome"] == "loss" for r in rounds)
    expected = "win" if wins > losses else "loss" if losses > wins else "draw"
    assert game["result"] == expected
    assert game["moves"][-1]["ai_move"] == rounds[-1]["ai"]


def test_move_on_finished_game_is_conflict(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="rps", config={"rounds": 1})
    move(client, game["id"], "rock")
    assert move(client, game["id"], "rock").status_code == 409


@pytest.mark.parametrize("value", [0, 4, "2", "rock", True])
def test_invalid_sticks_move_is_422(client: TestClient, value: Any) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks")
    resp = move(client, game["id"], value)
    assert resp.status_code == 422, resp.text
    assert client.get(f"/api/games/{game['id']}").json()["moves"] == []


def test_invalid_rps_move_is_422(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="rps")
    assert move(client, game["id"], "stone").status_code == 422


def test_games_are_private_to_their_player(client: TestClient) -> None:
    client.post("/api/auth/guest")
    game = new_game(client, game_type="sticks")
    client.post("/api/auth/logout")
    client.post("/api/auth/guest")
    assert client.get(f"/api/games/{game['id']}").status_code == 404
    assert move(client, game["id"], 1).status_code == 404
    assert client.get("/api/games").json() == []


def test_list_games_newest_first(client: TestClient) -> None:
    client.post("/api/auth/guest")
    first = new_game(client, game_type="sticks")
    second = new_game(client, game_type="rps")
    listed = client.get("/api/games").json()
    assert [g["id"] for g in listed] == [second["id"], first["id"]]
    assert "moves" not in listed[0]


def test_get_unknown_game_is_404(client: TestClient) -> None:
    client.post("/api/auth/guest")
    assert client.get("/api/games/00000000-0000-0000-0000-000000000000").status_code == 404
