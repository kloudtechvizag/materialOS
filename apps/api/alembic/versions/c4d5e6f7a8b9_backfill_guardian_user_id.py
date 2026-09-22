"""data repair: backfill guardians.user_id from users.guardian_id

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-09-22 16:00:00.000000

Real bug fix (Student 360 pass): services/guardian_portal.py::
create_guardian_portal_login has, since ADR-032, created a real User
row linked via User.guardian_id, but never set the back-reference
Guardian.user_id the model's own docstring describes as the field's
whole purpose ("link it when self-service actually activates"). Every
guardian who was ever granted real, working portal access has read as
"portal inactive" everywhere that checks Guardian.user_id, including
the new Student 360 Needs Attention panel and Guardians tab. This is a
one-time data repair, not a new default: it only sets user_id where a
real, matching User row already exists.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE guardians g
        SET user_id = u.id
        FROM users u
        WHERE u.guardian_id = g.id AND g.user_id IS NULL
        """
    )


def downgrade() -> None:
    # Not meaningfully reversible -- same reasoning as other pure data
    # repairs this codebase has already shipped (e.g. c7e1a49f0b6d).
    pass
