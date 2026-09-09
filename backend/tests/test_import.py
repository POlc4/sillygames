"""Import de parties jouées hors ligne : rejeu et validation côté serveur."""

from typing import Any

import pytest
from fastapi.testclient import TestClient


def import_game(client: TestClient, **body: Any) -> Any:
    return client.post("/api/games/import", json=body)


def sticks_turns(*pairs: tuple[int | None, int | None]) -> list[dict[str, int | None]]:
    return [{"player_move": p, "ai_move": a} for p, a in pairs]


def test_import_requires_session(client: TestClient) -> None:
    assert import_game(client, game_type="sticks", turns=[{"player_move": 1}]).status_code == 401


def test_import_sticks_game_player_wins(client: TestClient) -> None:
    client.post("/api/auth/guest")
    # 6 bâtonnets : joueur 1 -> 5, IA 1 -> 4, joueur 3 -> 1, IA 1 -> 0 : l'IA prend le dernier.
    resp = import_game(
        client,
        game_type="sticks",
        ai_strategy="perfect",
        config={"sticks": 6, "first": "player"},
        turns=sticks_turns((1, 1), (3, 1)),
        started_at="2026-09-10T10:00:00Z",
        finished_at="2026-09-10T10:01:00Z",
    )
    assert resp.status_code == 201, resp.text
    game = resp.json()
    assert game["status"] == "finished"
    assert game["result"] == "win"
    assert game["config"] == {"sticks": 6, "first": "player", "offline": True}
    assert [m["turn"] for m in game["moves"]] == [1, 2]
    assert game["started_at"].startswith("2026-09-10T10:00:00")
    assert game["finished_at"].startswith("2026-09-10T10:01:00")

    stats = client.get("/api/stats/me").json()
    assert stats["games"] == 1 and stats["wins"] == 1
    assert client.get("/api/games").json()[0]["id"] == game["id"]


def test_import_sticks_game_with_ai_opening(client: TestClient) -> None:
    client.post("/api/auth/guest")
    # 5 bâtonnets, l'IA ouvre : IA 1 -> 4, joueur 3 -> 1, IA 1 -> 0 : joueur gagne.
    resp = import_game(
        client,
        game_type="sticks",
        config={"sticks": 5, "first": "ai"},
        turns=sticks_turns((None, 1), (3, 1)),
    )
    assert resp.status_code == 201, resp.text
    assert [m["turn"] for m in resp.json()["moves"]] == [0, 1]
    assert resp.json()["result"] == "win"


def test_import_rps_game(client: TestClient) -> None:
    client.post("/api/auth/guest")
    resp = import_game(
        client,
        game_type="rps",
        config={"rounds": 2},
        turns=[
            {"player_move": "rock", "ai_move": "scissors"},
            {"player_move": "paper", "ai_move": "paper"},
        ],
    )
    assert resp.status_code == 201, resp.text
    game = resp.json()
    assert game["result"] == "win"
    assert game["state"]["player_score"] == 1


@pytest.mark.parametrize(
    ("body", "detail"),
    [
        (
            {"game_type": "sticks", "config": {"sticks": 6}, "turns": sticks_turns((1, 1))},
            "not finished",
        ),
        (
            {"game_type": "sticks", "config": {"sticks": 6}, "turns": sticks_turns((4, 1))},
            "cannot take 4",
        ),
        (
            {"game_type": "sticks", "config": {"sticks": 6}, "turns": sticks_turns((1, None))},
            "ai move expected",
        ),
        (
            {
                "game_type": "sticks",
                "config": {"sticks": 5, "first": "ai"},
                "turns": sticks_turns((1, 1)),
            },
            "opening turn",
        ),
        (
            {"game_type": "sticks", "config": {"first": "random"}, "turns": sticks_turns((1, 1))},
            "must be resolved",
        ),
        (
            {
                "game_type": "rps",
                "config": {"rounds": 1},
                "turns": [{"player_move": "stone", "ai_move": "rock"}],
            },
            "not a valid RpsMove",
        ),
        (
            {
                "game_type": "rps",
                "config": {"rounds": 1},
                "turns": [{"player_move": "rock", "ai_move": "rock"}] * 2,
            },
            "game is finished",
        ),
        (
            {"game_type": "sticks", "ai_strategy": "cheater", "turns": sticks_turns((1, 1))},
            "unknown strategy",
        ),
    ],
)
def test_import_rejects_invalid_games(
    client: TestClient, body: dict[str, Any], detail: str
) -> None:
    client.post("/api/auth/guest")
    resp = import_game(client, **body)
    assert resp.status_code == 422, resp.text
    assert detail in str(resp.json()["detail"])
    assert client.get("/api/games").json() == []


def test_import_rejects_more_than_one_hundred_turns(client: TestClient) -> None:
    client.post("/api/auth/guest")
    resp = import_game(
        client,
        game_type="rps",
        config={"rounds": 20},
        turns=[{"player_move": "rock", "ai_move": "rock"}] * 101,
    )
    assert resp.status_code == 422
