"""Add tenant brand logo path to tenants and companies.

Revision ID: e8f9a0b1c2d3
Revises: d5e6f7a8b9c0
Create Date: 2026-09-26 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('logo_path', sa.String(length=500), nullable=True)
    )
    op.add_column(
        'companies',
        sa.Column('logo_path', sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('companies', 'logo_path')
    op.drop_column('tenants', 'logo_path')
