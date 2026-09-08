import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    table_name: str | None = None,
    row_id: uuid.UUID | None = None,
    action: str | None = None,
    changed_by_user_id: uuid.UUID | None = None,
    occurred_after: datetime | None = None,
    occurred_before: datetime | None = None,
    limit: int = 100,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("audit.view")),
) -> list[AuditLog]:
    """The audit_trigger_fn DB trigger (B12) has populated this table
    since Slice 0 -- every row here already existed, this is the first
    endpoint that reads it back. RLS on audit_log itself (it's in
    RLS_TABLES) means this query can never see another tenant's rows,
    same guarantee as every other tenant-scoped table (sec51)."""
    stmt = select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(min(limit, 500))
    if table_name:
        stmt = stmt.where(AuditLog.table_name == table_name)
    if row_id:
        stmt = stmt.where(AuditLog.row_id == row_id)
    if action:
        stmt = stmt.where(AuditLog.action == action.upper())
    if changed_by_user_id:
        stmt = stmt.where(AuditLog.changed_by_user_id == changed_by_user_id)
    if occurred_after:
        stmt = stmt.where(AuditLog.occurred_at >= occurred_after)
    if occurred_before:
        stmt = stmt.where(AuditLog.occurred_at <= occurred_before)
    return db.execute(stmt).scalars().all()


@router.get("/tables", response_model=list[str])
def list_audited_tables(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("audit.view"))
) -> list[str]:
    """Distinct table_name values this tenant actually has audit rows
    for -- populates the filter dropdown without hardcoding
    AUDITED_TABLES (a migration-time constant) into the API layer."""
    return sorted(db.execute(select(AuditLog.table_name).distinct()).scalars().all())
