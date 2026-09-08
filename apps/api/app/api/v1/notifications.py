import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.notifications import NotificationDelivery, NotificationRule
from app.models.user import User
from app.schemas.notifications import (
    NotificationDeliveryOut,
    NotificationOut,
    NotificationRuleCreate,
    NotificationRuleOut,
    NotificationRuleUpdate,
    UnreadCountOut,
)
from app.services.notification_delivery import list_dead_letters, retry_delivery
from app.services.notifications import list_notifications, mark_read, unread_count

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications_endpoint(
    unread_only: bool = False, db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)
):
    return list_notifications(db, unread_only=unread_only)


@router.get("/unread-count", response_model=UnreadCountOut)
def unread_count_endpoint(db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)) -> UnreadCountOut:
    return UnreadCountOut(unread_count=unread_count(db))


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read_endpoint(notification_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(get_current_user)):
    return mark_read(db, notification_id)


# ------------------------------------------------------------ Delivery / dead-letter (sec41-43)

@router.get("/dead-letters", response_model=list[NotificationDeliveryOut])
def list_dead_letters_endpoint(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("notification_rules.manage"))
) -> list[NotificationDelivery]:
    return list_dead_letters(db)


@router.post("/dead-letters/{delivery_id}/retry", response_model=NotificationDeliveryOut)
def retry_dead_letter_endpoint(
    delivery_id: uuid.UUID, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("notification_rules.manage")),
) -> NotificationDelivery:
    delivery = db.get(NotificationDelivery, delivery_id)
    if delivery is None:
        raise AppError(ErrorCode.NOT_FOUND, "Delivery not found.", status_code=404)
    return retry_delivery(db, delivery_id=delivery_id, tenant_id=user.tenant_id, recipient_email=user.email)


# ------------------------------------------------------------------- Rules (sec21-22)

@router.get("/rules", response_model=list[NotificationRuleOut])
def list_rules(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("notification_rules.manage"))
) -> list[NotificationRule]:
    return db.execute(select(NotificationRule).order_by(NotificationRule.name)).scalars().all()


@router.post("/rules", response_model=NotificationRuleOut, status_code=201)
def create_rule(
    payload: NotificationRuleCreate, db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("notification_rules.manage")),
) -> NotificationRule:
    rule = NotificationRule(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(rule)
    db.flush()
    return rule


@router.patch("/rules/{rule_id}", response_model=NotificationRuleOut)
def update_rule(
    rule_id: uuid.UUID, payload: NotificationRuleUpdate, db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("notification_rules.manage")),
) -> NotificationRule:
    rule = db.get(NotificationRule, rule_id)
    if rule is None:
        raise AppError(ErrorCode.NOT_FOUND, "Notification rule not found.", status_code=404)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    db.flush()
    return rule
