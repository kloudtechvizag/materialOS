"""sec50/61: the operational control plane -- one endpoint aggregating
backup/notification/system health, not three isolated pages a
administrator has to visit separately. This is deliberately a read-only
aggregation over data every other endpoint here already exposes
individually (GET /backups, GET /system-health, GET /audit-logs) --
no new state, just a summary view.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.system_health import SystemHealthOut, check_celery_worker, check_database, check_redis, check_storage
from app.deps import get_db_tenant, require_permission
from app.models.audit import AuditLog
from app.models.backup import Backup
from app.models.notifications import NotificationDelivery
from app.schemas.backup import BackupOut

router = APIRouter(prefix="/command-center", tags=["operations"])


class CommandCenterOut(BaseModel):
    system_health: SystemHealthOut
    last_backup: BackupOut | None
    backups_last_7_days: int
    failed_backups_last_7_days: int
    backup_success_rate_pct: float | None
    notification_deliveries_last_7_days: int
    failed_deliveries_last_7_days: int
    notification_delivery_rate_pct: float | None
    dead_letter_count: int
    audit_events_last_24h: int


@router.get("", response_model=CommandCenterOut)
def get_command_center(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("system_health.view"))
) -> CommandCenterOut:
    components = [check_database(db), check_redis(), check_storage(), check_celery_worker()]
    if any(c.status == "unavailable" for c in components):
        overall = "unavailable" if all(c.status == "unavailable" for c in components) else "degraded"
    elif any(c.status == "degraded" for c in components):
        overall = "degraded"
    else:
        overall = "healthy"
    health = SystemHealthOut(checked_at=datetime.now(timezone.utc), overall=overall, components=components)

    last_backup = db.execute(select(Backup).order_by(Backup.created_at.desc()).limit(1)).scalar_one_or_none()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    day_ago = datetime.now(timezone.utc) - timedelta(days=1)

    recent_backups = db.execute(select(Backup).where(Backup.created_at >= week_ago)).scalars().all()
    backups_total = len(recent_backups)
    backups_failed = sum(1 for b in recent_backups if b.status == "failed")
    backup_rate = round((backups_total - backups_failed) / backups_total * 100, 1) if backups_total else None

    recent_deliveries = db.execute(select(NotificationDelivery).where(NotificationDelivery.created_at >= week_ago)).scalars().all()
    deliveries_total = len(recent_deliveries)
    deliveries_failed = sum(1 for d in recent_deliveries if d.status == "dead_letter")
    delivery_rate = round((deliveries_total - deliveries_failed) / deliveries_total * 100, 1) if deliveries_total else None
    dead_letter_count = db.execute(
        select(func.count()).select_from(NotificationDelivery).where(NotificationDelivery.status == "dead_letter")
    ).scalar_one()

    audit_count = db.execute(select(func.count()).select_from(AuditLog).where(AuditLog.occurred_at >= day_ago)).scalar_one()

    return CommandCenterOut(
        system_health=health,
        last_backup=last_backup,
        backups_last_7_days=backups_total,
        failed_backups_last_7_days=backups_failed,
        backup_success_rate_pct=backup_rate,
        notification_deliveries_last_7_days=deliveries_total,
        failed_deliveries_last_7_days=deliveries_failed,
        notification_delivery_rate_pct=delivery_rate,
        dead_letter_count=dead_letter_count,
        audit_events_last_24h=audit_count,
    )
