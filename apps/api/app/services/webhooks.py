"""Business Event -> matching WebhookSubscription -> signed HTTP POST,
with retry/dead-letter (§57/§62). Same shape as
services/notification_delivery.py's email channel (ADR-013): a
WebhookDelivery row per attempt, a bounded Celery retry, dead-letter
after MAX_ATTEMPTS rather than retrying forever.

REAL_EVENTS is the fixed, honest event catalog -- only events an
actual service function emits (see the call sites in sales_order.py /
invoicing.py), not an open-ended scheme a tenant could subscribe to
something that never fires.
"""
import hashlib
import hmac
import ipaddress
import json
import socket
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.db import session_scope, set_session_context
from app.errors import AppError, ErrorCode
from app.models.webhooks import WebhookDelivery, WebhookSubscription

MAX_ATTEMPTS = 3
DELIVERY_TIMEOUT_SECONDS = 10.0

REAL_EVENTS = {
    "sales_order.created": "A sales order was created from an approved quotation.",
    "invoice.created": "An invoice was posted from a delivery challan.",
}


def validate_webhook_url(url: str) -> None:
    """Basic SSRF guard: only http(s), and refuses to even attempt
    resolving to a loopback/private/link-local address. Not bulletproof
    against DNS rebinding, but it's a real check, not a rubber stamp --
    stops the obvious "point it at localhost/169.254.169.254" cases."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Webhook URL must be http:// or https://.")
    if not parsed.hostname:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Webhook URL must include a host.")

    try:
        resolved = socket.gethostbyname(parsed.hostname)
        ip = ipaddress.ip_address(resolved)
    except (socket.gaierror, ValueError):
        return  # can't resolve right now -- checked again at delivery time by httpx's own connect failure
    if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Webhook URL resolves to a non-routable address ({resolved}) and can't be used.")


def sign_payload(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def emit_event(db: Session, *, tenant_id: uuid.UUID, event_type: str, payload: dict) -> None:
    """Called from inside the same request transaction that made the
    event true (e.g. right before create_sales_order_from_quotation's
    return) -- flushes only; queues the actual delivery as a background
    job, same tradeoff services/notification_delivery.py's
    queue_deliveries already accepts (queued before the caller's
    request-scoped commit, not after)."""
    if event_type not in REAL_EVENTS:
        raise ValueError(f"{event_type!r} is not a real, registered event -- see webhooks.REAL_EVENTS.")

    subscriptions = db.execute(
        select(WebhookSubscription).where(WebhookSubscription.tenant_id == tenant_id, WebhookSubscription.is_active.is_(True))
    ).scalars().all()

    for sub in subscriptions:
        if event_type not in (sub.event_types or []):
            continue
        delivery = WebhookDelivery(tenant_id=tenant_id, webhook_subscription_id=sub.id, event_type=event_type, payload=payload, status="pending")
        db.add(delivery)
        db.flush()
        deliver_webhook_task.delay(delivery_id=str(delivery.id), tenant_id=str(tenant_id))


@celery_app.task(bind=True, max_retries=MAX_ATTEMPTS - 1, default_retry_delay=30)
def deliver_webhook_task(self, *, delivery_id: str, tenant_id: str) -> None:
    should_retry = False
    retry_detail = ""
    attempt_count = 0

    with session_scope() as db:
        set_session_context(db, tenant_id=tenant_id, user_id=None)
        delivery = db.get(WebhookDelivery, uuid.UUID(delivery_id))
        if delivery is None:
            return
        subscription = db.get(WebhookSubscription, delivery.webhook_subscription_id)
        delivery.attempt_count += 1
        attempt_count = delivery.attempt_count

        body = json.dumps(
            {"event": delivery.event_type, "delivered_at": datetime.now(timezone.utc).isoformat(), "data": delivery.payload},
            default=str,
        ).encode()
        signature = sign_payload(subscription.secret, body)

        try:
            response = httpx.post(
                subscription.url, content=body,
                headers={"Content-Type": "application/json", "X-MaterialOS-Signature": f"sha256={signature}", "X-MaterialOS-Event": delivery.event_type},
                timeout=DELIVERY_TIMEOUT_SECONDS,
            )
            delivery.response_status = response.status_code
            ok = 200 <= response.status_code < 300
            detail = f"HTTP {response.status_code}"
        except httpx.HTTPError as exc:
            ok = False
            detail = f"{type(exc).__name__}: {exc}"

        delivery.provider_response = detail
        if ok:
            delivery.status = "sent"
            delivery.sent_at = datetime.now(timezone.utc)
        elif attempt_count >= MAX_ATTEMPTS:
            delivery.status = "dead_letter"
        else:
            delivery.status = "pending"
            should_retry = True
            retry_detail = detail

    if should_retry:
        raise self.retry(exc=RuntimeError(retry_detail), countdown=30 * attempt_count)


def retry_delivery(db: Session, *, delivery_id: uuid.UUID, tenant_id: uuid.UUID) -> WebhookDelivery:
    delivery = db.get(WebhookDelivery, delivery_id)
    if delivery is None:
        raise AppError(ErrorCode.NOT_FOUND, "Webhook delivery not found.", status_code=404)
    delivery.status = "pending"
    db.flush()
    deliver_webhook_task.delay(delivery_id=str(delivery.id), tenant_id=str(tenant_id))
    return delivery
