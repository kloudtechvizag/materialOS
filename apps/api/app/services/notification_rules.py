"""sec21-22: table-driven notification rules. A "visual rule builder"
in this pass is a form over these fields (WHEN trigger_type, optional
threshold, THEN priority + channels) -- not a drag-and-drop condition
editor (see ADR-013). Mirrors services/approvals.py's
ensure_default_approval_rules exactly: a handful of sensible defaults
seeded once at signup, additive rows from there.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import StockBalance
from app.models.masters import Item
from app.models.notifications import NotificationRule
from app.services.notification_delivery import queue_deliveries
from app.services.notifications import notify

# (name, trigger_type, threshold_value, priority, channels)
DEFAULT_RULES: list[tuple[str, str, Decimal | None, str, list[str]]] = [
    ("Low stock", "stock_low", None, "warning", ["in_app"]),
    ("Invoice overdue", "invoice_overdue", None, "warning", ["in_app"]),
    ("Credit limit exceeded", "credit_limit_exceeded", None, "critical", ["in_app"]),
    ("Backup failed", "backup_failed", None, "critical", ["in_app"]),
    # ADR-014 (spec sec18, sec58): the usage/billing side reuses this
    # same rule engine rather than a parallel notification mechanism.
    ("Usage approaching limit", "usage_near_limit", None, "warning", ["in_app"]),
    ("Usage limit reached", "usage_limit_reached", None, "critical", ["in_app"]),
    ("Trial ending soon", "trial_ending", None, "warning", ["in_app"]),
    ("Payment failed", "payment_failed", None, "critical", ["in_app"]),
    ("Subscription renewed", "subscription_renewed", None, "info", ["in_app"]),
    ("Subscription cancelled", "subscription_cancelled", None, "warning", ["in_app"]),
]


def ensure_default_notification_rules(db: Session, *, tenant_id: uuid.UUID) -> None:
    existing_types = {r.trigger_type for r in db.execute(select(NotificationRule).where(NotificationRule.tenant_id == tenant_id)).scalars()}
    for name, trigger_type, threshold, priority, channels in DEFAULT_RULES:
        if trigger_type not in existing_types:
            db.add(NotificationRule(
                tenant_id=tenant_id, name=name, trigger_type=trigger_type, threshold_value=threshold,
                priority=priority, channels=channels,
            ))
    db.flush()


def fire_trigger(
    db: Session, *, tenant_id: uuid.UUID, trigger_type: str, title: str, message: str,
    entity_type: str | None = None, entity_id: uuid.UUID | None = None,
    metric_value: Decimal | None = None, recipient_email: str | None = None,
) -> list:
    """Looks up every active rule for `trigger_type`. A rule with a
    threshold_value only fires when metric_value meets or exceeds it
    (e.g. "invoice overdue AND amount > threshold") -- a rule with no
    threshold fires whenever the caller decides the underlying
    condition is already true (the caller, e.g. a stock check, is the
    one that knows the actual business rule; this engine only decides
    *whether anyone configured wants to hear about it and how*). No
    matching active rule -- including no rule at all, if an admin never
    configured one -- means no notification, by design (sec21:
    "administrators should be able to configure", not a hardcoded
    alert nobody asked for).
    """
    rules = db.execute(
        select(NotificationRule).where(
            NotificationRule.tenant_id == tenant_id, NotificationRule.trigger_type == trigger_type,
            NotificationRule.is_active.is_(True),
        )
    ).scalars().all()

    notifications = []
    for rule in rules:
        if rule.threshold_value is not None and (metric_value is None or metric_value < rule.threshold_value):
            continue
        notification = notify(
            db, tenant_id=tenant_id, notification_type=trigger_type, title=title, message=message,
            entity_type=entity_type, entity_id=entity_id, priority=rule.priority,
        )
        queue_deliveries(db, tenant_id=tenant_id, notification=notification, channels=rule.channels, recipient_email=recipient_email)
        notifications.append(notification)
    return notifications


def check_stock_low_and_notify(db: Session, *, tenant_id: uuid.UUID, warehouse_id: uuid.UUID, item_id: uuid.UUID) -> None:
    """dev.md §20's own example ("WHEN Stock < Reorder Level"). Opt-in
    per item (Item.reorder_level is NULL by default -- see its
    docstring) and wired into the sale paths that already deduct stock
    at checkout (POS today; other stock-deducting flows -- dispatch,
    print job media consumption -- are an additive follow-up, not
    wired in this pass, see ADR-013). Never raises: a notification
    failure must not turn a successful sale into a failed one.
    """
    try:
        item = db.get(Item, item_id)
        if item is None or item.reorder_level is None:
            return
        on_hand = db.execute(
            select(StockBalance.qty_on_hand).where(
                StockBalance.tenant_id == tenant_id, StockBalance.warehouse_id == warehouse_id, StockBalance.item_id == item_id
            )
        ).scalar_one_or_none() or Decimal("0")
        if on_hand > item.reorder_level:
            return
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="stock_low",
            title=f"Low stock: {item.name}",
            message=f"{item.name} ({item.sku}) is at {on_hand} {item.base_uom}, at or below its reorder level of {item.reorder_level}.",
            entity_type="item", entity_id=item.id,
        )
    except Exception:  # noqa: BLE001 -- a stock-low check must never fail the sale it's attached to
        pass
