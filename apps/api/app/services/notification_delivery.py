"""sec19-20/41-43: Business Event -> Notification (in-app, instant) ->
for any other configured channel, a NotificationDelivery row + a
background Celery task that actually sends it, retries transient
failures with backoff, and lands in a dead-letter state after
max_attempts rather than retrying forever (sec42: "do not endlessly
retry failed messages").
"""

import uuid

from sqlalchemy import select

from app.celery_app import celery_app
from app.db import session_scope, set_session_context
from app.models.notifications import Notification, NotificationDelivery
from app.services.notification_channels import send_email

MAX_ATTEMPTS = 3


def queue_deliveries(db, *, tenant_id: uuid.UUID, notification: Notification, channels: list[str], recipient_email: str | None) -> None:
    """Called in the same transaction that created `notification` --
    only flushes (the caller's request-scoped session commits), then
    enqueues the actual send as a background job per non-in-app
    channel so an email/SMS provider hiccup can never slow down or
    fail the request that triggered the notification."""
    for channel in channels:
        if channel == "in_app":
            continue  # the Notification row itself is the in-app delivery -- nothing further to send
        delivery = NotificationDelivery(tenant_id=tenant_id, notification_id=notification.id, channel=channel, status="pending")
        db.add(delivery)
        db.flush()
        deliver_notification_task.delay(delivery_id=str(delivery.id), tenant_id=str(tenant_id), recipient_email=recipient_email)


@celery_app.task(bind=True, max_retries=MAX_ATTEMPTS - 1, default_retry_delay=30)
def deliver_notification_task(self, *, delivery_id: str, tenant_id: str, recipient_email: str | None) -> None:
    from datetime import datetime, timezone

    # Every state update below happens INSIDE this block so
    # session_scope's own commit persists it unconditionally -- the
    # retry (if needed) is raised only after the `with` exits cleanly,
    # never from inside it. Raising self.retry() inside the block would
    # trip session_scope's `except Exception: db.rollback(); raise`
    # and silently undo the attempt_count/status update this function
    # exists to record.
    should_retry = False
    retry_detail = ""
    attempt_count = 0

    with session_scope() as db:
        set_session_context(db, tenant_id=tenant_id, user_id=None)
        delivery = db.get(NotificationDelivery, uuid.UUID(delivery_id))
        if delivery is None:
            return
        notification = db.get(Notification, delivery.notification_id)
        delivery.attempt_count += 1
        attempt_count = delivery.attempt_count

        if delivery.channel == "email":
            if not recipient_email:
                delivery.status = "dead_letter"
                delivery.provider_response = "No recipient email on file."
                result = None
            else:
                result = send_email(to_address=recipient_email, subject=notification.title, body=notification.message)
        else:
            result = None
            delivery.status = "dead_letter"
            delivery.provider_response = f"Channel {delivery.channel!r} is not implemented (ADR-013)."

        if result is not None:
            delivery.provider_response = result.detail
            if result.ok:
                delivery.status = "sent"
                delivery.sent_at = datetime.now(timezone.utc)
            elif attempt_count >= MAX_ATTEMPTS:
                delivery.status = "dead_letter"
            else:
                delivery.status = "pending"
                should_retry = True
                retry_detail = result.detail

    if should_retry:
        raise self.retry(exc=RuntimeError(retry_detail), countdown=30 * attempt_count)


def retry_delivery(db, *, delivery_id: uuid.UUID, tenant_id: uuid.UUID, recipient_email: str | None) -> NotificationDelivery:
    """sec43: an administrator can manually retry a dead-lettered
    delivery."""
    from app.errors import AppError, ErrorCode

    delivery = db.get(NotificationDelivery, delivery_id)
    if delivery is None:
        raise AppError(ErrorCode.NOT_FOUND, "Delivery not found.", status_code=404)
    delivery.status = "pending"
    db.flush()
    deliver_notification_task.delay(delivery_id=str(delivery.id), tenant_id=str(tenant_id), recipient_email=recipient_email)
    return delivery


def list_dead_letters(db, *, limit: int = 100) -> list[NotificationDelivery]:
    return db.execute(
        select(NotificationDelivery).where(NotificationDelivery.status == "dead_letter").order_by(NotificationDelivery.created_at.desc()).limit(limit)
    ).scalars().all()
