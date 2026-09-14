"""metal rates

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-14 05:00:00.000000

The Jewellery industry profile's pricing_strategy ("weight_making_
wastage") was previously informational only -- resolve_price() ignored
it entirely. This table is the real input that makes it functional: a
tenant enters their own day's metal rate (no live market-rate feed
exists or is integrated, same "refuse rather than fake" discipline as
the e-invoice/e-way adapters), and services/pricing.py::resolve_price
reads the most recent one at or before the pricing date.

Tenant-scoped, standard RLS (no platform-bypass clause needed -- this
is ordinary per-tenant business configuration, not a cross-tenant
support/admin concern).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'metal_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False, index=True),
        sa.Column('metal', sa.String(length=20), nullable=False),
        sa.Column('purity', sa.String(length=10), nullable=False),
        sa.Column('rate_per_gram', sa.Numeric(18, 4), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'company_id', 'metal', 'purity', 'effective_date', name='uq_metal_rates_company_metal_purity_date'),
    )
    op.execute("ALTER TABLE metal_rates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE metal_rates FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON metal_rates
        USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid)
        """
    )


def downgrade() -> None:
    op.drop_table('metal_rates')
