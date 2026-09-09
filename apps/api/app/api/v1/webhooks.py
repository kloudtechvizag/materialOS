import secrets
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.webhooks import WebhookDelivery, WebhookSubscription
from app.models.user import User
from app.schemas.webhooks import (
    WebhookDeliveryOut,
    WebhookEventCatalogEntry,
    WebhookSubscriptionCreate,
    WebhookSubscriptionCreated,
    WebhookSubscriptionOut,
    WebhookSubscriptionUpdate,
)
from app.services.webhooks import REAL_EVENTS, retry_delivery, validate_webhook_url

router = APIRouter(tags=["webhooks"])


@router.get("/webhooks/events", response_model=list[WebhookEventCatalogEntry])
def list_webhook_events(_user: User = Depends(require_permission("webhooks.view"))) -> list[dict]:
    return [{"event_type": k, "description": v} for k, v in REAL_EVENTS.items()]


@router.get("/webhook-subscriptions", response_model=list[WebhookSubscriptionOut])
def list_webhook_subscriptions(
    db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("webhooks.view")),
) -> list[WebhookSubscription]:
    return db.execute(select(WebhookSubscription).order_by(WebhookSubscription.created_at.desc())).scalars().all()


@router.post("/webhook-subscriptions", response_model=WebhookSubscriptionCreated, status_code=201)
def create_webhook_subscription(
    payload: WebhookSubscriptionCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("webhooks.create")),
) -> WebhookSubscription:
    validate_webhook_url(payload.url)
    unknown = set(payload.event_types) - set(REAL_EVENTS)
    if unknown:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown event type(s): {sorted(unknown)}. See GET /webhooks/events.")

    subscription = WebhookSubscription(
        tenant_id=user.tenant_id, url=payload.url, event_types=payload.event_types,
        description=payload.description, secret=secrets.token_hex(32),
    )
    db.add(subscription)
    db.flush()
    return subscription


@router.patch("/webhook-subscriptions/{subscription_id}", response_model=WebhookSubscriptionOut)
def update_webhook_subscription(
    subscription_id: uuid.UUID, payload: WebhookSubscriptionUpdate, db: Session = Depends(get_db_tenant),
    _user: User = Depends(require_permission("webhooks.edit")),
) -> WebhookSubscription:
    subscription = db.get(WebhookSubscription, subscription_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "Webhook subscription not found.", status_code=404)
    updates = payload.model_dump(exclude_unset=True)
    if "url" in updates and updates["url"]:
        validate_webhook_url(updates["url"])
    if "event_types" in updates and updates["event_types"]:
        unknown = set(updates["event_types"]) - set(REAL_EVENTS)
        if unknown:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown event type(s): {sorted(unknown)}. See GET /webhooks/events.")
    for field, value in updates.items():
        setattr(subscription, field, value)
    db.flush()
    return subscription


@router.delete("/webhook-subscriptions/{subscription_id}", status_code=204)
def delete_webhook_subscription(
    subscription_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("webhooks.delete")),
) -> None:
    subscription = db.get(WebhookSubscription, subscription_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "Webhook subscription not found.", status_code=404)
    db.delete(subscription)
    db.flush()


@router.get("/webhook-subscriptions/{subscription_id}/deliveries", response_model=list[WebhookDeliveryOut])
def list_webhook_deliveries(
    subscription_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("webhooks.view")),
) -> list[WebhookDelivery]:
    return db.execute(
        select(WebhookDelivery).where(WebhookDelivery.webhook_subscription_id == subscription_id)
        .order_by(WebhookDelivery.created_at.desc()).limit(50)
    ).scalars().all()


@router.post("/webhook-deliveries/{delivery_id}/retry", response_model=WebhookDeliveryOut)
def retry_webhook_delivery(
    delivery_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("webhooks.manage")),
) -> WebhookDelivery:
    return retry_delivery(db, delivery_id=delivery_id, tenant_id=user.tenant_id)
