"""backfill library permissions onto existing owner roles

Revision ID: eb22dcc13664
Revises: ba6a231d6400
Create Date: 2026-10-01 06:05:00.000000

Same class of gap fixed in a1f4c9e02b7d/c7e1a49f0b6d/b8c9d0e1f2a3/
a9b0c1d2e3f4/c1d2e3f4a5b6/e3f4a5b6c7d8/a5b6c7d8e9f0/c7d8e9f0a1b2/
e9f0a1b2c3d4/b2c3d4e5f6a7/1e28cdc7beb7/279588495a35:
services/permissions.py's RESOURCES gained "library" in this same
change. Covers Book + BookCopy + BookIssue together.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'eb22dcc13664'
down_revision: Union[str, None] = 'ba6a231d6400'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCES = ["library"]
ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage", "calculate", "lock", "pay"]


def upgrade() -> None:
    for resource in RESOURCES:
        for action in ACTIONS:
            op.execute(
                f"""
                INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
                SELECT gen_random_uuid(), '{resource}.{action}', '{resource}', '{action}', now(), now()
                WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = '{resource}.{action}')
                """
            )

    op.execute(
        f"""
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND p.resource IN ({",".join(f"'{r}'" for r in RESOURCES)})
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    # Not meaningfully reversible -- same reasoning as c7e1a49f0b6d.
    pass
