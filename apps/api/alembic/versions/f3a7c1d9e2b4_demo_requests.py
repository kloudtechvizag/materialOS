"""demo requests

Revision ID: f3a7c1d9e2b4
Revises: b599f891244d
Create Date: 2026-09-09 00:00:00.000000

Creates the platform-level demo_requests table (no tenant_id, no RLS --
same precedent as industry_profiles: this row exists before any tenant
does, captured from the public marketing site's "Book a demo" form).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f3a7c1d9e2b4'
down_revision: Union[str, None] = 'b599f891244d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'demo_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('full_name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('company_name', sa.String(length=200), nullable=False),
        sa.Column('industry_slug', sa.String(length=50), nullable=True),
        sa.Column('message', sa.String(length=2000), nullable=True),
        sa.Column('source_page', sa.String(length=200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    # No RLS: demo_requests carries no tenant_id -- platform data, like
    # industry_profiles (see that migration's docstring).


def downgrade() -> None:
    op.drop_table('demo_requests')
