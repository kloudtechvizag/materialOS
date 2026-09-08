"""backfill subscription/billing permissions onto existing owner roles

Revision ID: c7e1a49f0b6d
Revises: f3c8b6a91d47
Create Date: 2026-09-08 13:30:00.000000

Same class of gap fixed in a1f4c9e02b7d, pre-empted this time rather
than waiting for it to be reported again: services/permissions.py's
RESOURCES gained "subscription" and "billing" in this same change.
ensure_permission_catalog() only inserts missing Permission rows at
app boot / signup -- it never runs during a migration -- so this
migration inserts the 16 new permission codes directly (8 ACTIONS x 2
new resources) and then grants them to every tenant's is_system owner
role, identical in shape to a1f4c9e02b7d.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c7e1a49f0b6d'
down_revision: Union[str, None] = 'f3c8b6a91d47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCES = ["subscription", "billing"]
ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage"]


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
          AND p.resource IN ('subscription', 'billing')
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    # Same reasoning as a1f4c9e02b7d's downgrade: not meaningfully
    # reversible (we don't know which grants pre-existed), and granting/
    # ungranting a permission isn't a schema change either way.
    pass
