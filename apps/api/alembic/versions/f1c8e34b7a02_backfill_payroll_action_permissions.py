"""backfill calculate/lock/pay action permissions onto existing owner roles

Revision ID: f1c8e34b7a02
Revises: b4a97d02e6c1
Create Date: 2026-09-08 14:45:00.000000

Same class of gap fixed three times now in this codebase's history
(a1f4c9e02b7d, c7e1a49f0b6d, b4a97d02e6c1) -- caught this time by
actually calling POST /payroll/runs against a live tenant and getting
a real 403, not by re-reading the code. services/permissions.py's
ACTIONS gained "calculate", "lock", and "pay" (payroll.calculate,
payroll.lock, payroll.pay -- spec sec77's own exact permission list)
in this same change. Unlike the two prior backfills, this one spans
every RESOURCE (ACTIONS changed, not RESOURCES) -- most of the new
codes (e.g. companies.calculate) are simply never checked anywhere,
same as companies.manage or companies.approve already are; only
payroll.calculate/lock/pay are real call sites today.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f1c8e34b7a02'
down_revision: Union[str, None] = 'b4a97d02e6c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_ACTIONS = ["calculate", "lock", "pay"]


def upgrade() -> None:
    for action in NEW_ACTIONS:
        op.execute(
            f"""
            INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
            SELECT gen_random_uuid(), resource || '.{action}', resource, '{action}', now(), now()
            FROM (SELECT DISTINCT resource FROM permissions) r
            WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = resource || '.{action}')
            """
        )

    action_list_sql = ", ".join(f"'{a}'" for a in NEW_ACTIONS)
    op.execute(
        f"""
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND p.action IN ({action_list_sql})
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    pass
