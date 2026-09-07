import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant
from app.models.notifications import Notification
from app.schemas.notifications import NotificationOut, UnreadCountOut
from app.services.notifications import list_notifications, mark_read, unread_count

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications_endpoint(
    unread_only: bool = False, db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)
) -> list[Notification]:
    return list_notifications(db, unread_only=unread_only)


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count_endpoint(db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)) -> UnreadCountOut:
    return UnreadCountOut(unread_count=unread_count(db))


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read_endpoint(
    notification_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)
) -> Notification:
    return mark_read(db, notification_id)
