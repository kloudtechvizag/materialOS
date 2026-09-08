"""ADR-014: the subscription lifecycle's daily scheduled progression --
trial -> grace -> expired, and renewal -> past_due invoice generation
-- runs as a background job per tenant, same reasoning and same
per-tenant-isolation pattern as ADR-013's backup_tasks.py.
"""
from sqlalchemy import select

from app.celery_app import celery_app
from app.db import session_scope, set_session_context
from app.models.tenant import Tenant
from app.services.subscriptions import run_subscription_lifecycle


@celery_app.task
def run_subscription_lifecycle_task() -> None:
    with session_scope() as db:
        tenant_ids = db.execute(select(Tenant.id).where(Tenant.status == "active")).scalars().all()

    for tenant_id in tenant_ids:
        with session_scope() as db:
            set_session_context(db, tenant_id=str(tenant_id), user_id=None)
            run_subscription_lifecycle(db, tenant_id=tenant_id)
