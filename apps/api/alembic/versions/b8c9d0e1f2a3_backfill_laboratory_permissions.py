"""backfill laboratory permissions onto existing owner roles

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-09-14 06:05:00.000000

Same class of gap fixed in a1f4c9e02b7d/c7e1a49f0b6d, pre-empted this
time rather than waiting for it to be reported again: services/
permissions.py's RESOURCES gained "laboratory" in this same change.
ensure_permission_catalog() only inserts missing Permission rows at
app boot / signup -- it never runs during a migration -- so this
migration inserts the new permission codes directly and grants them to
every tenant's is_system owner role.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCES = ["laboratory"]
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
        """
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND p.resource IN ('laboratory')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    # Not meaningfully reversible -- same reasoning as c7e1a49f0b6d.
    pass
