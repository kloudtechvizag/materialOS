"""industry profile golden workflow

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-09-14 22:00:00.000000

Adds `golden_workflow` to industry_profiles -- the Dashboard's "Start
the golden transaction" card was hardcoded to the trade/dealer flow
(New quotation -> approve -> sales order -> dispatch -> invoice ->
payment) regardless of the active business profile, so a Laboratory
tenant's dashboard pointed at a workflow with no real relationship to
what that tenant actually does. `server_default='{}'` means every
already-seeded row (all 25 profiles) gets the empty object for free at
ALTER TABLE time -- only the two profiles that genuinely have their
own distinct, real workflow (laboratory, printing_press) need an
explicit UPDATE here. The other 23 keep `{}`, which the frontend reads
as "no bespoke override -- use the generic quotation flow" (still
real, still the correct flow for a trade/dealer business), not as
"show nothing" the way an empty dashboard_widgets list means for
laboratory -- these are deliberately different semantics for the two
fields, not an oversight (see DashboardPage's own comment).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WORKFLOWS = {
    "laboratory": {
        "cta_label": "Register sample",
        "cta_href": "/lab/samples",
        "steps": ["Register sample", "Run tests", "Generate report", "Sign off"],
    },
    "printing_press": {
        "cta_label": "New print job",
        "cta_href": "/print-jobs",
        "steps": ["New print job", "Production", "Finishing", "Dispatch", "Invoice"],
    },
}


def upgrade() -> None:
    op.add_column('industry_profiles', sa.Column('golden_workflow', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))

    industry_profiles = sa.table('industry_profiles', sa.column('slug', sa.String()), sa.column('golden_workflow', postgresql.JSONB()))
    conn = op.get_bind()
    for slug, workflow in WORKFLOWS.items():
        conn.execute(industry_profiles.update().where(industry_profiles.c.slug == slug).values(golden_workflow=workflow))


def downgrade() -> None:
    op.drop_column('industry_profiles', 'golden_workflow')
