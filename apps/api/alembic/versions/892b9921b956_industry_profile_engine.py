"""industry profile engine

Revision ID: 892b9921b956
Revises: b8742e901ed4
Create Date: 2026-09-08 00:00:00.000000

Creates the platform-level industry_profiles catalog (no tenant_id, no
RLS -- see app/models/industry.py), seeds the single `building_materials`
row (matching services/industry.py's PROFILE_DEFINITIONS so
ensure_industry_profile_catalog treats it as already present), links
Company to it, and backfills every pre-existing company. Retail/Pharmacy
and future profiles need no migration -- they ship as new
PROFILE_DEFINITIONS entries, seeded idempotently at app startup, because
no company references them yet.

Also adds Batch.expiry_date (generic; FEFO picking for the Pharmacy
profile reads it, but any perishable good can use it).
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '892b9921b956'
down_revision: Union[str, None] = 'b8742e901ed4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

BUILDING_MATERIALS_MODULES = [
    "sales", "purchase", "inventory", "warehouse", "dispatch", "fleet",
    "credit", "collections", "projects", "field_sales", "accounting", "gst",
]
BUILDING_MATERIALS_WIDGETS = [
    "outstanding", "invoiced", "open_quotations", "open_sales_orders",
    "active_items", "active_customers",
]
BUILDING_MATERIALS_INVENTORY_FLAGS = {
    "batch_tracking": True, "expiry_tracking": False, "fefo": False, "weight_tracking": True,
}


def upgrade() -> None:
    op.create_table(
        'industry_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('slug', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('terminology', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('enabled_modules', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('navigation_config', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('dashboard_widgets', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('inventory_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('pricing_strategy', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_industry_profiles_slug'),
    )
    # No RLS: industry_profiles carries no tenant_id -- it's a platform
    # catalog like permissions, not tenant data (test_every_tenant_scoped_
    # table_has_rls_enabled only checks tables that *have* a tenant_id
    # column, so this table is correctly exempt, not merely skipped).

    industry_profiles = sa.table(
        'industry_profiles',
        sa.column('id', sa.UUID()),
        sa.column('slug', sa.String()),
        sa.column('name', sa.String()),
        sa.column('category', sa.String()),
        sa.column('terminology', postgresql.JSONB()),
        sa.column('enabled_modules', postgresql.JSONB()),
        sa.column('navigation_config', postgresql.JSONB()),
        sa.column('dashboard_widgets', postgresql.JSONB()),
        sa.column('inventory_flags', postgresql.JSONB()),
        sa.column('pricing_strategy', sa.String()),
        sa.column('is_active', sa.Boolean()),
    )
    op.bulk_insert(
        industry_profiles,
        [
            {
                'id': str(uuid.uuid4()),
                'slug': 'building_materials',
                'name': 'Building Materials',
                'category': 'construction',
                'terminology': {},
                'enabled_modules': BUILDING_MATERIALS_MODULES,
                # Populated in Slice B to mirror the (currently static)
                # frontend NAVIGATION_CONFIG -- the shape is owned by the
                # frontend, nothing reads this column yet.
                'navigation_config': [],
                'dashboard_widgets': BUILDING_MATERIALS_WIDGETS,
                'inventory_flags': BUILDING_MATERIALS_INVENTORY_FLAGS,
                'pricing_strategy': 'standard',
                'is_active': True,
            }
        ],
    )

    op.add_column('companies', sa.Column('industry_profile_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_companies_industry_profile_id'), 'companies', ['industry_profile_id'], unique=False)
    op.create_foreign_key(
        'fk_companies_industry_profile_id', 'companies', 'industry_profiles',
        ['industry_profile_id'], ['id'], ondelete='SET NULL',
    )
    op.execute(
        """
        UPDATE companies
        SET industry_profile_id = (SELECT id FROM industry_profiles WHERE slug = 'building_materials')
        WHERE industry_profile_id IS NULL
        """
    )

    op.add_column('batches', sa.Column('expiry_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('batches', 'expiry_date')

    op.drop_constraint('fk_companies_industry_profile_id', 'companies', type_='foreignkey')
    op.drop_index(op.f('ix_companies_industry_profile_id'), table_name='companies')
    op.drop_column('companies', 'industry_profile_id')

    op.drop_table('industry_profiles')
