"""backfill owner role permissions

Revision ID: a1f4c9e02b7d
Revises: dfa9c730177c
Create Date: 2026-09-08 12:30:00.000000

ADR-013's own bugfix (fixing services/permissions.py's ACTIONS list to
include "restore"/"manage") only helps *new* signups: tenant_signup.py
grants a brand-new owner role every Permission row that exists in the
`permissions` table *at that moment*. Every tenant created before this
session's four new resources (audit/backup/system_health/
notification_rules) landed -- which is every tenant in this dev
database, including the demo tenants -- has an owner role with no
RolePermission rows for any of them at all, so `require_permission(...)`
correctly, but unhelpfully, returns 403 for an owner who should be able
to do anything.

This is a one-time catch-up, not a general "keep permissions in sync"
mechanism (no such mechanism exists yet -- a genuinely new resource
landing in the future will have the exact same gap for existing
tenants until either this pattern is repeated or a proper sync job is
built; recorded as accepted debt in ADR-013, not solved generally
here). Deliberately scoped to `is_system = true AND name = 'owner'`
only: custom roles a tenant created themselves were never meant to
have every permission and this must not silently widen them.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a1f4c9e02b7d'
down_revision: Union[str, None] = 'dfa9c730177c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Runs as the superuser migration role, so this legitimately spans
    # every tenant's rows in one statement -- the same reasoning as the
    # industry-profile-engine migration's cross-tenant `companies`
    # backfill. gen_random_uuid() is available (pgcrypto enabled by the
    # audit-trigger migration).
    op.execute(
        """
        INSERT INTO role_permissions (id, tenant_id, role_id, permission_id, created_at, updated_at)
        SELECT gen_random_uuid(), r.tenant_id, r.id, p.id, now(), now()
        FROM roles r
        CROSS JOIN permissions p
        WHERE r.is_system = true AND r.name = 'owner'
          AND NOT EXISTS (
              SELECT 1 FROM role_permissions rp
              WHERE rp.role_id = r.id AND rp.permission_id = p.id
          )
        """
    )


def downgrade() -> None:
    # Not reversible in a targeted way -- we don't know which of an
    # owner role's RolePermission rows pre-existed this migration versus
    # were inserted by it. Downgrading a permission grant isn't a real
    # schema change either way (no column/table to drop), so this is a
    # no-op, same as any other pure-data catch-up migration.
    pass
