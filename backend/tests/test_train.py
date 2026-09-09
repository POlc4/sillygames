"""Scripts d'entraînement : convergence du Q-learning, prior n-grammes, export."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.games.ai.ml import QTableSticks
from ml import export, train_rps, train_sticks
from ml.train_sticks import agreement_with_perfect


def test_q_learning_rediscovers_the_4k_plus_1_rule() -> None:
    table = train_sticks.train(episodes=6000, seed=42)
    assert set(table) == {str(n) for n in range(1, 51)}
    assert agreement_with_perfect(table) >= 0.9
    # Position perdante : toutes les valeurs sont négatives ; gagnante : la meilleure est positive.
    assert max(table["9"]) < 0
    assert max(table["10"]) > 0
    assert QTableSticks(table=table).choose(_state(10)) == 1


def _state(n: int) -> object:
    from app.games.base import Player
    from app.games.sticks import SticksState

    return SticksState(sticks=n, current=Player.AI)


def test_train_rps_learns_a_simple_pattern(tmp_path: Path) -> None:
    data = tmp_path / "rps.jsonl"
    lines = [json.dumps({"moves": ["rock", "paper", "scissors"] * 3}) for _ in range(30)]
    data.write_text("\n".join(lines) + "\n", encoding="utf-8")

    sequences = train_rps.load_sequences(data)
    assert len(sequences) == 30
    model = train_rps.ngram_counts(sequences[:24])
    assert train_rps.accuracy(model, sequences[24:]) == 1.0
    assert train_rps.accuracy({}, sequences) == 0.0


def test_export_writes_one_line_per_finished_rps_game(
    client: TestClient, db_session: object, capsys: object
) -> None:
    from sqlalchemy.orm import Session

    client.post("/api/auth/guest")
    game = client.post("/api/games", json={"game_type": "rps", "config": {"rounds": 2}}).json()
    client.post(f"/api/games/{game['id']}/moves", json={"move": "rock"})
    client.post(f"/api/games/{game['id']}/moves", json={"move": "paper"})
    client.post("/api/games", json={"game_type": "rps"})  # en cours : ignorée
    client.post("/api/games", json={"game_type": "sticks"})  # autre jeu : ignorée

    assert isinstance(db_session, Session)
    count = export.export(db_session)
    out = capsys.readouterr().out.strip().splitlines()  # type: ignore[attr-defined]
    assert count == 1
    assert json.loads(out[0])["moves"] == ["rock", "paper"]
