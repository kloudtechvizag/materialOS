import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.notifications import Notification


def notify(
    db: Session, *, tenant_id: uuid.UUID, notification_type: str, title: str, message: str,
    entity_type: str | None = None, entity_id: uuid.UUID | None = None,
) -> Notification:
    notification = Notification(
        tenant_id=tenant_id, notification_type=notification_type, title=title, message=message,
        entity_type=entity_type, entity_id=entity_id,
    )
    db.add(notification)
    db.flush()
    return notification


def list_notifications(db: Session, *, unread_only: bool = False, limit: int = 50) -> list[Notification]:
    stmt = select(Notification).order_by(Notification.created_at.desc()).limit(limit)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    return db.execute(stmt).scalars().all()


def mark_read(db: Session, notification_id: uuid.UUID) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise AppError(ErrorCode.NOT_FOUND, "Notification not found.", status_code=404)
    notification.is_read = True
    db.flush()
    return notification


def unread_count(db: Session) -> int:
    from sqlalchemy import func

    return db.execute(select(func.count()).select_from(Notification).where(Notification.is_read.is_(False))).scalar_one()
