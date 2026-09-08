"""ADR-014 (spec sec16-19): usage metering and limit enforcement. Two
distinct kinds of limit, deliberately not unified into one mechanism:

- "Quota" limits (users, companies, branches, warehouses) are a live
  COUNT(*) against the real table, checked at the moment of creation --
  a deactivated user frees a seat immediately, no period to wait out.
- "Meter" limits (invoices_per_month, api_calls_per_month, ...) are a
  monotonic counter for the subscription's current billing period,
  tracked in usage_records and reset implicitly by moving to a new
  period (a new period_start means a fresh row).

Both funnel through the same soft/hard-limit + near-limit-notification
policy so a caller doesn't have to think about which kind it's using.
"""
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.subscriptions import Subscription, UsageRecord
from app.services.entitlements import effective_limit, get_subscription, is_hard_limit
from app.services.notification_rules import fire_trigger

NEAR_LIMIT_THRESHOLDS = (Decimal("0.75"), Decimal("0.90"))


def _maybe_notify_threshold(db: Session, *, tenant_id: uuid.UUID, limit_key: str, used: Decimal, limit: int) -> None:
    if limit <= 0:
        return
    ratio = used / Decimal(limit)
    if ratio >= 1:
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="usage_limit_reached",
            title=f"{limit_key.replace('_', ' ').title()} limit reached",
            message=f"You've used {used:g} / {limit} for {limit_key.replace('_', ' ')}. Upgrade your plan to continue.",
        )
    elif ratio >= NEAR_LIMIT_THRESHOLDS[1]:
        fire_trigger(
            db, tenant_id=tenant_id, trigger_type="usage_near_limit",
            title=f"Approaching your {limit_key.replace('_', ' ')} limit",
            message=f"You've used {used:g} / {limit} ({ratio:.0%}) for {limit_key.replace('_', ' ')}.",
        )


def enforce_quota(db: Session, *, tenant_id: uuid.UUID, limit_key: str, current_count: int, increment: int = 1) -> None:
    """sec16's "seat" style limits. Raises USAGE_LIMIT_EXCEEDED (402) if
    a hard limit would be exceeded; otherwise fires a near-limit
    notification and allows the action through."""
    limit = effective_limit(db, tenant_id, limit_key)
    if limit is None:
        return  # unlimited

    projected = current_count + increment
    if projected > limit:
        if is_hard_limit(db, tenant_id, limit_key):
            raise AppError(
                ErrorCode.USAGE_LIMIT_EXCEEDED,
                f"You've reached your plan's {limit_key.replace('_', ' ')} limit ({limit}). Upgrade your plan to add more.",
                status_code=402,
                details={"limit_key": limit_key, "limit": limit, "current": current_count},
            )
        _maybe_notify_threshold(db, tenant_id=tenant_id, limit_key=limit_key, used=Decimal(projected), limit=limit)
        return

    _maybe_notify_threshold(db, tenant_id=tenant_id, limit_key=limit_key, used=Decimal(projected), limit=limit)


def _get_or_create_usage_record(db: Session, *, tenant_id: uuid.UUID, subscription: Subscription, metric_key: str) -> UsageRecord:
    record = db.execute(
        select(UsageRecord).where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.subscription_id == subscription.id,
            UsageRecord.metric_key == metric_key,
            UsageRecord.period_start == subscription.current_period_start,
        )
    ).scalar_one_or_none()
    if record is None:
        record = UsageRecord(
            tenant_id=tenant_id, subscription_id=subscription.id, metric_key=metric_key,
            period_start=subscription.current_period_start, period_end=subscription.current_period_end,
            quantity=Decimal("0"),
        )
        db.add(record)
        db.flush()
    return record


def get_meter_usage(db: Session, *, tenant_id: uuid.UUID, metric_key: str) -> Decimal:
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        return Decimal("0")
    record = db.execute(
        select(UsageRecord).where(
            UsageRecord.tenant_id == tenant_id,
            UsageRecord.subscription_id == subscription.id,
            UsageRecord.metric_key == metric_key,
            UsageRecord.period_start == subscription.current_period_start,
        )
    ).scalar_one_or_none()
    return record.quantity if record else Decimal("0")


def enforce_meter(db: Session, *, tenant_id: uuid.UUID, metric_key: str, increment: Decimal = Decimal("1")) -> None:
    """sec17's period-based meters. Checks the limit BEFORE recording,
    so a blocked call never gets counted -- then records the usage
    once the caller's own action actually goes through (call this
    right before committing the thing being metered)."""
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.PAYMENT_REQUIRED, "No active subscription.", status_code=402)

    limit = effective_limit(db, tenant_id, metric_key)
    current = get_meter_usage(db, tenant_id=tenant_id, metric_key=metric_key)
    projected = current + increment

    if limit is not None and projected > limit:
        if is_hard_limit(db, tenant_id, metric_key):
            raise AppError(
                ErrorCode.USAGE_LIMIT_EXCEEDED,
                f"You've reached your plan's {metric_key.replace('_', ' ')} limit ({limit}) for this billing period. "
                "Upgrade your plan to continue.",
                status_code=402,
                details={"limit_key": metric_key, "limit": limit, "current": int(current)},
            )

    record = _get_or_create_usage_record(db, tenant_id=tenant_id, subscription=subscription, metric_key=metric_key)
    record.quantity = projected
    db.flush()

    if limit is not None:
        _maybe_notify_threshold(db, tenant_id=tenant_id, limit_key=metric_key, used=projected, limit=limit)


def usage_summary(db: Session, *, tenant_id: uuid.UUID) -> list[dict]:
    """Powers Settings -> Subscription -> Usage (sec18). Reports every
    LIMIT_KEY this plan tracks, whether it's a live quota or a period
    meter, and whether it's actually enforced yet (ADR-014's
    ENFORCED_LIMIT_KEYS) so the UI can be honest about which numbers
    are informational."""
    from app.models.tenant import Branch, Company, Warehouse
    from app.models.masters import Customer, Item, Supplier
    from app.models.sales import Invoice
    from app.models.user import User
    from app.services.billing_plans import ENFORCED_LIMIT_KEYS, LIMIT_KEYS

    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        return []

    quota_counts = {
        "users": db.execute(select(User.id).where(User.tenant_id == tenant_id, User.is_active == True)).all(),  # noqa: E712
        "companies": db.execute(select(Company.id).where(Company.tenant_id == tenant_id)).all(),
        "branches": db.execute(select(Branch.id).where(Branch.tenant_id == tenant_id)).all(),
        "warehouses": db.execute(select(Warehouse.id).where(Warehouse.tenant_id == tenant_id)).all(),
        "customers": db.execute(select(Customer.id).where(Customer.tenant_id == tenant_id)).all(),
        "suppliers": db.execute(select(Supplier.id).where(Supplier.tenant_id == tenant_id)).all(),
        "items": db.execute(select(Item.id).where(Item.tenant_id == tenant_id)).all(),
    }
    meter_keys = {"invoices_per_month", "purchase_orders_per_month", "sales_orders_per_month", "api_calls_per_month", "ai_requests_per_month"}
    # invoices_per_month is enforced live at creation (see api/v1/sales.py);
    # report the real count either way for an accurate dashboard even
    # where a meter isn't wired to record_and_enforce yet.
    live_invoice_count = len(db.execute(select(Invoice.id).where(
        Invoice.tenant_id == tenant_id, Invoice.invoice_date >= subscription.current_period_start.date()
    )).all())

    rows = []
    for key in LIMIT_KEYS:
        limit = effective_limit(db, tenant_id, key)
        if key in quota_counts:
            used = Decimal(len(quota_counts[key]))
        elif key == "invoices_per_month":
            used = Decimal(max(live_invoice_count, int(get_meter_usage(db, tenant_id=tenant_id, metric_key=key))))
        elif key in meter_keys:
            used = get_meter_usage(db, tenant_id=tenant_id, metric_key=key)
        else:
            used = Decimal("0")
        rows.append({
            "limit_key": key,
            "used": used,
            "limit": limit,
            "enforced": key in ENFORCED_LIMIT_KEYS,
        })
    return rows
