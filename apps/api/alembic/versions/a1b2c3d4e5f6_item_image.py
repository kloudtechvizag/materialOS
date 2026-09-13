"""item image

Revision ID: a1b2c3d4e5f6
Revises: f3a7c1d9e2b4
Create Date: 2026-09-14 00:00:00.000000

Product-catalogue images (real, tenant-uploaded photos of a merchant's
own inventory -- never a generic stock photo standing in for a real
product, see docs/decisions/ADR-019). image_path mirrors the same
storage-relative-path convention already used by fleet.py's POD photos
and imports.py's uploaded files (app/storage.py) -- nullable, since most
items will never have one and that's fine (ItemsPage/POS fall back to
an icon, not a blank box).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f3a7c1d9e2b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('items', sa.Column('image_path', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('items', 'image_path')
