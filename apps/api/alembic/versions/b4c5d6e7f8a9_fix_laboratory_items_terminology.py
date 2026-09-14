"""fix laboratory items terminology collision

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-09-14 20:00:00.000000

The laboratory profile's terminology.items_label relabeled the generic
Item catalog (SETUP > Items) to "Samples" -- set back when this profile
was config-only and Items stood in for the sample concept, before
LabSample existed (ADR-021). Now that real Samples live under
LABORATORY, that label collided with a genuinely different entity of
the same name and confused which "Samples" a user was looking at
(reported live, screenshot showed SETUP > Samples highlighted active
next to LABORATORY > Samples in the same sidebar). Relabeled to what
the Item catalog actually holds for a lab -- reagents and consumable
supplies.

Same one-time-UPDATE reasoning as c9d4f27a5e83 (that migration's own
docstring): ensure_industry_profile_catalog() only ever INSERTs a
missing slug, never UPDATEs an existing one, so the already-seeded
laboratory row needs an explicit correction here.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_TERMINOLOGY = {"item_label": "Sample", "items_label": "Samples", "item_name_example": "Water Sample - Borewell A", "item_uom_example": "ML", "customer_name_example": "ABC Diagnostics Pvt Ltd", "supplier_name_example": "Lab Reagents & Supplies Co"}
NEW_TERMINOLOGY = {"item_label": "Reagent", "items_label": "Reagents & Supplies", "item_name_example": "Sodium Hydroxide (NaOH) 500g", "item_uom_example": "BTL", "customer_name_example": "ABC Diagnostics Pvt Ltd", "supplier_name_example": "Lab Reagents & Supplies Co"}


def upgrade() -> None:
    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('terminology', postgresql.JSONB()))
    op.get_bind().execute(industry_profiles.update().where(industry_profiles.c.slug == 'laboratory').values(terminology=NEW_TERMINOLOGY))


def downgrade() -> None:
    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('terminology', postgresql.JSONB()))
    op.get_bind().execute(industry_profiles.update().where(industry_profiles.c.slug == 'laboratory').values(terminology=OLD_TERMINOLOGY))
