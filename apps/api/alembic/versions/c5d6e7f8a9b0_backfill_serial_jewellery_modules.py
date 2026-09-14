"""backfill serial_tracking and jewellery module keys

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-09-14 21:00:00.000000

Reported live: a Laboratory tenant's SETUP menu showed "Metal rates"
(a jewellery-only feature -- gold/silver rate entry for weight-priced
items). Auditing the whole sidebar for the same class of bug found six
nav items with no `module` gate at all, so they rendered for every
industry profile regardless of relevance:

- Metal rates -- jewellery only (inventory_flags.weight_tracking was
  already jewellery-exclusive, but that flag isn't something
  buildNavigation() can gate a nav item on -- only `enabled_modules`
  is. No profile had a dedicated "jewellery" module key to gate on.)
- Serial numbers & RMA -- meant for computer_hardware/mobile/
  jewellery/electronics (the profiles with inventory_flags.
  serial_tracking=True per each one's own comment / the SerialUnit
  model's own docstring: "Real gap for Electronics/Mobile/Computer
  Hardware domain logic") -- same problem, no matching module key
  existed to gate on.
- Credit & debit notes, Report builder, Import from Tally/Busy,
  Receipts -- all fundamentally built on Sales/Purchase/GST data
  (verified against each page's own API calls) and meaningless for a
  tenant with none of those enabled. Every profile except laboratory
  has "accounting" alongside sales/purchase/gst (checked across all 25
  profile definitions), so gating these four on "accounting" is a
  precise, zero-risk fix -- it changes nothing for the other 24
  profiles and only removes dead pages from laboratory's sidebar.

This migration adds the two new module keys ("jewellery",
"serial_tracking") to the already-seeded rows for the four profiles
that need them; `services/industry.py`'s PROFILE_DEFINITIONS carries
the same values for any environment seeded fresh from here on. The
nav-item-level gating itself is a frontend-only change
(lib/navigation.ts) needing no migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_MODULES = {
    "computer_hardware": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst", "serial_tracking"],
    "mobile": ["sales", "purchase", "inventory", "pos", "accounting", "gst", "serial_tracking"],
    "jewellery": ["sales", "purchase", "inventory", "pos", "credit", "accounting", "gst", "jewellery", "serial_tracking"],
    "electronics": ["sales", "purchase", "inventory", "pos", "credit", "collections", "accounting", "gst", "serial_tracking"],
}
OLD_MODULES = {
    "computer_hardware": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
    "mobile": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
    "jewellery": ["sales", "purchase", "inventory", "pos", "credit", "accounting", "gst"],
    "electronics": ["sales", "purchase", "inventory", "pos", "credit", "collections", "accounting", "gst"],
}


def upgrade() -> None:
    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('enabled_modules', postgresql.JSONB()))
    conn = op.get_bind()
    for slug, modules in NEW_MODULES.items():
        conn.execute(industry_profiles.update().where(industry_profiles.c.slug == slug).values(enabled_modules=modules))


def downgrade() -> None:
    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('enabled_modules', postgresql.JSONB()))
    conn = op.get_bind()
    for slug, modules in OLD_MODULES.items():
        conn.execute(industry_profiles.update().where(industry_profiles.c.slug == slug).values(enabled_modules=modules))
