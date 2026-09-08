"""sec3/53: backups run as background jobs, not inline in a request --
a multi-table JSON dump + encryption is exactly the kind of work
dev.md's own "use background jobs for: Backup..." calls out. One
Celery task per tenant, so one tenant's slow/failing backup can never
block or fail another's (this platform's data is already isolated by
RLS; the backup schedule keeps that isolation, not just the data).
"""

import uuid

from sqlalchemy import select

from app.celery_app import celery_app
from app.db import session_scope, set_session_context
from app.models.tenant import Company, Tenant
from app.services.backup import execute_backup, run_backup
from app.services.notification_rules import fire_trigger


def _notify_if_failed(db, *, tenant_id: uuid.UUID, backup) -> None:
    if backup.status == "failed":
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="backup_failed",
            title="Backup failed",
            message=f"Backup {backup.id} failed: {backup.error_message or 'unknown error'}",
            entity_type="backup", entity_id=backup.id,
        )


@celery_app.task
def execute_backup_task(backup_id: str, tenant_id: str) -> None:
    """On-demand trigger (sec15: "Run Backup Now") -- the API layer
    already created a `pending` Backup row synchronously (so it has an
    id to show immediately); this just does the slow dump/encrypt/
    store part in the background."""
    with session_scope() as db:
        set_session_context(db, tenant_id=tenant_id, user_id=None)
        backup = execute_backup(db, backup_id=uuid.UUID(backup_id))
        _notify_if_failed(db, tenant_id=uuid.UUID(tenant_id), backup=backup)


@celery_app.task
def run_scheduled_backups_task() -> None:
    """sec3: daily full backup, the default recommendation -- wired to
    Celery beat (see celery_app.py). Enumerates tenants directly
    (Tenant carries no RLS -- it's the platform root, see
    models/tenant.py) since this is a platform-level maintenance job,
    not a request scoped to one tenant."""
    with session_scope() as db:
        tenant_ids = db.execute(select(Tenant.id).where(Tenant.status == "active")).scalars().all()

    for tenant_id in tenant_ids:
        with session_scope() as db:
            set_session_context(db, tenant_id=str(tenant_id), user_id=None)
            company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
            if company is None:
                continue
            backup = run_backup(db, tenant_id=tenant_id, company_id=company.id, user_id=None)
            _notify_if_failed(db, tenant_id=tenant_id, backup=backup)
