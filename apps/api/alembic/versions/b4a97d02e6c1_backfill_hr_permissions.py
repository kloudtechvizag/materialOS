"""backfill people & payroll permissions onto existing owner roles

Revision ID: b4a97d02e6c1
Revises: e5b2f8c1a930
Create Date: 2026-09-08 14:30:00.000000

Same class of gap fixed in a1f4c9e02b7d and c7e1a49f0b6d, pre-empted
again: services/permissions.py's RESOURCES gained "employees",
"employee_compensation", "departments", "shifts", "attendance",
"leave", "payroll", and "advances" in this same change.
ensure_permission_catalog() only inserts missing Permission rows at
app boot / signup, never during a migration, so this inserts the new
permission codes directly and grants them to every tenant's is_system
owner role, identical in shape to the two prior backfills.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b4a97d02e6c1'
down_revision: Union[str, None] = 'e5b2f8c1a930'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESOURCES = ["employees", "employee_compensation", "departments", "shifts", "attendance", "leave", "payroll", "advances"]
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

    resource_list_sql = ", ".join(f"'{r}'" for r in RESOURCES)
    op.execute(
        f"""
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND p.resource IN ({resource_list_sql})
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    pass
