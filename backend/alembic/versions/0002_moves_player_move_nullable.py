"""moves.player_move nullable (AI opening move when the AI starts)

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("moves", "player_move", existing_type=sa.String(16), nullable=True)


def downgrade() -> None:
    op.execute("DELETE FROM moves WHERE player_move IS NULL")
    op.alter_column("moves", "player_move", existing_type=sa.String(16), nullable=False)
