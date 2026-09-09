"""Exporte les séquences de coups des parties terminées de pierre-feuille-ciseaux en JSONL.

Une ligne par partie : {"game_id": ..., "player_id": ..., "ai_strategy": ..., "moves": [...]}.
Utilise DATABASE_URL (config de l'app). Sur la VM :
    docker compose exec -T backend python -m ml.export > rps.jsonl

    uv run python -m ml.export > data/rps.jsonl
"""

import json
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.db import engine_for
from app.models import Game


def export(session: Session) -> int:
    games = session.scalars(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.game_type == "rps", Game.status == "finished")
        .order_by(Game.started_at)
    )
    count = 0
    for game in games:
        moves = [m.player_move for m in game.moves if m.player_move]
        sys.stdout.write(
            json.dumps(
                {
                    "game_id": str(game.id),
                    "player_id": str(game.player_id),
                    "ai_strategy": game.ai_strategy,
                    "moves": moves,
                }
            )
            + "\n"
        )
        count += 1
    return count


def main() -> None:
    with Session(engine_for(get_settings().database_url)) as session:
        count = export(session)
    sys.stderr.write(f"{count} parties exportées\n")


if __name__ == "__main__":
    main()
