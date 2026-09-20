"""backfill inventory_value dashboard widget for dealer profiles

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-09-20 10:00:00.000000

Dashboard redesign: added a real "Inventory value" KPI (StockBalance.
qty_on_hand * Item.standard_cost, GET /dashboard/summary's new
`inventory_value` field) for every profile built on services/industry.
py's shared DEALER_WIDGETS/DEALER_WIDGETS_WITH_QUOTES constants -- the
13 stock-trading profiles (building_materials, retail, fmcg, auto_parts,
food_beverage, computer_hardware, furniture, book_publishing, travel,
electrical, paper_mill, paint, mobile). DEALER_WIDGETS_WITH_QUOTES
profiles also drop "active_items" to keep the KPI grid at 6 cards
(active_items and inventory_value both describe the same catalog, and
inventory_value is the more informative of the two for a trading
business) -- DEALER_WIDGETS itself keeps active_items since it has no
open_quotations widget to fill that sixth slot instead.

ensure_industry_profile_catalog() only ever INSERTs a missing slug, so
already-seeded rows need this direct backfill; PROFILE_DEFINITIONS
carries the same values for any environment seeded fresh from here on.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEALER_WIDGETS = ["outstanding", "invoiced", "open_sales_orders", "inventory_value", "active_items", "active_customers"]
DEALER_WIDGETS_WITH_QUOTES = [
    "outstanding", "invoiced", "open_quotations", "open_sales_orders", "inventory_value", "active_customers",
]
OLD_DEALER_WIDGETS = ["outstanding", "invoiced", "open_sales_orders", "active_items", "active_customers"]
OLD_DEALER_WIDGETS_WITH_QUOTES = [
    "outstanding", "invoiced", "open_quotations", "open_sales_orders", "active_items", "active_customers",
]

WITH_QUOTES_SLUGS = ["building_materials", "auto_parts", "furniture", "travel", "electrical"]
PLAIN_SLUGS = ["retail", "fmcg", "food_beverage", "computer_hardware", "book_publishing", "paper_mill", "paint", "mobile"]


def _apply(widgets_by_slug: dict[str, list[str]]) -> None:
    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('dashboard_widgets', postgresql.JSONB()))
    conn = op.get_bind()
    for slug, widgets in widgets_by_slug.items():
        conn.execute(industry_profiles.update().where(industry_profiles.c.slug == slug).values(dashboard_widgets=widgets))


def upgrade() -> None:
    _apply({slug: DEALER_WIDGETS_WITH_QUOTES for slug in WITH_QUOTES_SLUGS} | {slug: DEALER_WIDGETS for slug in PLAIN_SLUGS})


def downgrade() -> None:
    _apply({slug: OLD_DEALER_WIDGETS_WITH_QUOTES for slug in WITH_QUOTES_SLUGS} | {slug: OLD_DEALER_WIDGETS for slug in PLAIN_SLUGS})
