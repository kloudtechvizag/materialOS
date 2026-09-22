"""multi-campus: branch_id on SchoolClass/Student/AdmissionEnquiry/
AdmissionApplication/Hostel/BookCopy, target_branch_id on Announcement

Revision ID: f1c2d3e4b5a6
Revises: 9e363b5003e4
Create Date: 2026-09-22 10:00:00.000000

ADR-038 (the "full retrofit" scope): reuses the existing core `Branch`
model as "campus" rather than a new table -- see models/education.py's
own updated docstring. Every existing tenant has exactly one Branch
(created atomically by tenants/signup), but the backfill still resolves
per-tenant (earliest-created branch) rather than assuming a single
global branch, since `POST /branches` has always been a generic,
ungated endpoint any tenant could have already called before this
migration ever ran.

`target_branch_id` on `announcements` needs no backfill: it stays NULL
for every existing row, which is the correct, unchanged meaning for
target_type="school" (every campus) -- nothing existing silently
narrows scope.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f1c2d3e4b5a6'
down_revision: Union[str, None] = '9e363b5003e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, fk_ondelete) -- every one of these gets a NOT NULL branch_id,
# backfilled from the tenant's own earliest branch before the NOT NULL
# constraint is applied.
BACKFILLED_TABLES = [
    "school_classes",
    "students",
    "admission_enquiries",
    "admission_applications",
    "hostels",
    "book_copies",
]


def upgrade() -> None:
    for table in BACKFILLED_TABLES:
        op.add_column(table, sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True))
        op.execute(
            f"""
            UPDATE {table} t
            SET branch_id = (
                SELECT b.id FROM branches b WHERE b.tenant_id = t.tenant_id ORDER BY b.created_at LIMIT 1
            )
            WHERE t.branch_id IS NULL
            """
        )
        op.alter_column(table, "branch_id", nullable=False)
        op.create_foreign_key(f"fk_{table}_branch_id", table, "branches", ["branch_id"], ["id"], ondelete="RESTRICT")
        op.create_index(f"ix_{table}_branch_id", table, ["branch_id"])

    op.add_column("announcements", sa.Column("target_branch_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_announcements_target_branch_id", "announcements", "branches", ["target_branch_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_announcements_target_branch_id", "announcements", ["target_branch_id"])


def downgrade() -> None:
    op.drop_index("ix_announcements_target_branch_id", table_name="announcements")
    op.drop_constraint("fk_announcements_target_branch_id", "announcements", type_="foreignkey")
    op.drop_column("announcements", "target_branch_id")

    for table in reversed(BACKFILLED_TABLES):
        op.drop_index(f"ix_{table}_branch_id", table_name=table)
        op.drop_constraint(f"fk_{table}_branch_id", table, type_="foreignkey")
        op.drop_column(table, "branch_id")
