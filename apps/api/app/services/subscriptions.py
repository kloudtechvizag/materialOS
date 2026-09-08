"""ADR-014: subscription lifecycle -- create at signup, upgrade,
downgrade (usage-gated, spec sec24), cancel, reactivate, and the
scheduled state-machine progression (trial -> grace -> expired,
renewal -> past_due -> active on payment). Mirrors services/backup.py's
"flush-only service functions, caller owns the commit" convention.
"""
import calendar
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.billing_plans import Plan, PlanLimit
from app.models.subscriptions import BillingAddress, Subscription
from app.services.billing_plans import LIMIT_KEYS, get_default_signup_plan, get_plan_by_slug
from app.services.entitlements import get_subscription
from app.services.notification_rules import fire_trigger
from app.services.subscription_billing import generate_invoice

GRACE_PERIOD_DAYS = 7
QUOTA_LIMIT_KEYS = {"users", "companies", "branches", "warehouses", "customers", "suppliers", "items"}


def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + months
    year = dt.year + month // 12
    month = month % 12 + 1
    day = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def period_end(billing_cycle: str, start: datetime) -> datetime:
    return _add_months(start, 12 if billing_cycle == "yearly" else 1)


def get_billing_address(db: Session, tenant_id: uuid.UUID) -> BillingAddress | None:
    return db.execute(
        select(BillingAddress).where(BillingAddress.tenant_id == tenant_id).order_by(BillingAddress.created_at.desc())
    ).scalars().first()


def create_subscription_for_new_tenant(db: Session, *, tenant_id: uuid.UUID) -> Subscription:
    plan = get_default_signup_plan(db) or get_plan_by_slug(db, "free")
    if plan is None:
        raise AppError(ErrorCode.INTERNAL_ERROR, "No signup plan is configured.", status_code=500)

    now = datetime.now(timezone.utc)
    on_trial = plan.trial_days > 0
    subscription = Subscription(
        tenant_id=tenant_id, plan_id=plan.id, status="trialing" if on_trial else "active",
        billing_cycle="yearly", current_period_start=now,
        current_period_end=now + timedelta(days=plan.trial_days) if on_trial else period_end("yearly", now),
        trial_ends_at=now + timedelta(days=plan.trial_days) if on_trial else None,
    )
    db.add(subscription)
    db.flush()
    return subscription


def _plan_price(plan: Plan, billing_cycle: str) -> Decimal:
    price = plan.yearly_price if billing_cycle == "yearly" else plan.monthly_price
    return price if price is not None else Decimal("0")


def _quota_usage(db: Session, tenant_id: uuid.UUID, limit_key: str) -> int:
    from app.models.masters import Customer, Item, Supplier
    from app.models.tenant import Branch, Company, Warehouse
    from app.models.user import User

    model_by_key = {
        "users": (User, User.is_active == True),  # noqa: E712
        "companies": (Company, None),
        "branches": (Branch, None),
        "warehouses": (Warehouse, None),
        "customers": (Customer, None),
        "suppliers": (Supplier, None),
        "items": (Item, None),
    }
    model, extra_filter = model_by_key[limit_key]
    stmt = select(model.id).where(model.tenant_id == tenant_id)
    if extra_filter is not None:
        stmt = stmt.where(extra_filter)
    return len(db.execute(stmt).all())


def check_downgrade_blockers(db: Session, *, tenant_id: uuid.UUID, new_plan: Plan) -> list[dict]:
    """spec sec24: never silently drop data on downgrade -- report every
    quota the tenant currently exceeds on the target plan so the caller
    can show "remove N users before downgrading" up front."""
    new_limits = {
        pl.limit_key: pl.limit_value
        for pl in db.execute(select(PlanLimit).where(PlanLimit.plan_id == new_plan.id)).scalars().all()
    }
    violations = []
    for limit_key in QUOTA_LIMIT_KEYS:
        new_limit = new_limits.get(limit_key)
        if new_limit is None:
            continue
        current = _quota_usage(db, tenant_id, limit_key)
        if current > new_limit:
            violations.append({"limit_key": limit_key, "current": current, "new_limit": new_limit})
    return violations


def _change_plan(
    db: Session, *, tenant_id: uuid.UUID, subscription: Subscription, new_plan: Plan, billing_cycle: str,
) -> tuple[Subscription, "SubscriptionInvoice | None"]:  # noqa: F821
    """spec sec25: simple day-based proration within the current period --
    unused credit on the old plan offsets the new plan's pro-rated
    charge for the remaining days. A net-negative result (a downgrade
    credit) is not carried forward to a future invoice in this pass --
    recorded as a deliberate simplification in ADR-014, not silently
    dropped without a trace (the zero/negative case still returns
    None -- no invoice -- rather than fabricating a credit note).

    Only applies while `status == "active"` -- proration means "you
    already paid for the old plan's remaining days," which is only true
    once a real payment has activated the subscription. During a trial
    (or past_due/grace_period, where the current period was never
    actually paid for either) current_period_end reflects the trial/
    grace window, not a paid year -- amortizing a full annual price
    over a 14-day trial window would fabricate a huge, wrong credit
    (caught via live verification: a trial tenant upgrading plans
    produced a nonsensical multi-thousand-rupee credit). A plan change
    during any of those states is free -- the next real invoice
    (generated by run_subscription_lifecycle at trial/grace end) simply
    bills whatever plan is current at that time."""
    old_plan = db.get(Plan, subscription.plan_id)
    now = datetime.now(timezone.utc)
    prorated_amount = Decimal("0")

    if subscription.status == "active":
        period_total = (subscription.current_period_end - subscription.current_period_start).total_seconds()
        days_remaining_fraction = max((subscription.current_period_end - now).total_seconds(), 0) / period_total if period_total > 0 else 0

        old_price = _plan_price(old_plan, subscription.billing_cycle) if old_plan else Decimal("0")
        new_price = _plan_price(new_plan, billing_cycle)
        unused_credit = (old_price * Decimal(str(days_remaining_fraction))).quantize(Decimal("0.01"))
        new_charge = (new_price * Decimal(str(days_remaining_fraction))).quantize(Decimal("0.01"))
        prorated_amount = new_charge - unused_credit

    subscription.plan_id = new_plan.id
    subscription.billing_cycle = billing_cycle
    db.flush()

    invoice = None
    if prorated_amount > 0:
        billing_address = get_billing_address(db, tenant_id)
        invoice = generate_invoice(
            db, subscription=subscription, tenant_id=tenant_id,
            tenant_state=billing_address.state if billing_address else None,
            line_items=[(f"Plan change proration: {old_plan.name if old_plan else 'previous plan'} -> {new_plan.name}", Decimal("1"), prorated_amount)],
            billing_period_start=now.date(), billing_period_end=subscription.current_period_end.date(),
        )

    return subscription, invoice


def upgrade_subscription(db: Session, *, tenant_id: uuid.UUID, new_plan_slug: str, billing_cycle: str) -> tuple[Subscription, object]:
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "No subscription found for this tenant.", status_code=404)
    new_plan = get_plan_by_slug(db, new_plan_slug)
    if new_plan is None or not new_plan.is_active:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown plan: {new_plan_slug!r}", status_code=422)

    return _change_plan(db, tenant_id=tenant_id, subscription=subscription, new_plan=new_plan, billing_cycle=billing_cycle)


def downgrade_subscription(db: Session, *, tenant_id: uuid.UUID, new_plan_slug: str, billing_cycle: str) -> tuple[Subscription, object]:
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "No subscription found for this tenant.", status_code=404)
    new_plan = get_plan_by_slug(db, new_plan_slug)
    if new_plan is None or not new_plan.is_active:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown plan: {new_plan_slug!r}", status_code=422)

    violations = check_downgrade_blockers(db, tenant_id=tenant_id, new_plan=new_plan)
    if violations:
        raise AppError(
            ErrorCode.PLAN_DOWNGRADE_BLOCKED,
            "You're over this plan's limits. Reduce usage before downgrading.",
            status_code=409,
            details={"violations": violations},
        )

    return _change_plan(db, tenant_id=tenant_id, subscription=subscription, new_plan=new_plan, billing_cycle=billing_cycle)


def cancel_subscription(db: Session, *, tenant_id: uuid.UUID, at_period_end: bool = True) -> Subscription:
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "No subscription found for this tenant.", status_code=404)

    now = datetime.now(timezone.utc)
    subscription.cancelled_at = now
    if at_period_end:
        subscription.cancel_at_period_end = True
    else:
        subscription.status = "cancelled"
        subscription.cancel_at_period_end = False
    db.flush()

    fire_trigger(
        db, tenant_id=tenant_id, trigger_type="subscription_cancelled", title="Subscription cancelled",
        message="Your subscription will end at the close of the current billing period." if at_period_end
        else "Your subscription has been cancelled immediately.",
    )
    return subscription


def reactivate_subscription(db: Session, *, tenant_id: uuid.UUID) -> tuple[Subscription, object]:
    """If cancellation was scheduled but the period hasn't ended yet,
    this is free -- just undo the flag. Otherwise (already cancelled/
    expired/suspended) a fresh invoice is generated and the same
    webhook-driven payment path that activates any other subscription
    payment (services/subscriptions.py's caller in app/billing/service.py)
    is what actually flips status back to active -- reactivation never
    grants access on the frontend's say-so alone (spec sec61)."""
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        raise AppError(ErrorCode.NOT_FOUND, "No subscription found for this tenant.", status_code=404)

    if subscription.cancel_at_period_end and subscription.status not in ("cancelled", "expired", "suspended"):
        subscription.cancel_at_period_end = False
        subscription.cancelled_at = None
        db.flush()
        return subscription, None

    if subscription.status not in ("cancelled", "expired", "suspended"):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Subscription is already {subscription.status} -- nothing to reactivate.",
            status_code=409,
        )

    plan = db.get(Plan, subscription.plan_id)
    billing_address = get_billing_address(db, tenant_id)
    now = datetime.now(timezone.utc)
    invoice = generate_invoice(
        db, subscription=subscription, tenant_id=tenant_id,
        tenant_state=billing_address.state if billing_address else None,
        line_items=[(f"Reactivation: {plan.name}", Decimal("1"), _plan_price(plan, subscription.billing_cycle))],
        billing_period_start=now.date(), billing_period_end=period_end(subscription.billing_cycle, now).date(),
    )
    return subscription, invoice


def run_subscription_lifecycle(db: Session, *, tenant_id: uuid.UUID) -> None:
    """One tenant's worth of scheduled state-machine progression --
    called per-tenant by the Celery beat task (app/services/billing_tasks.py)
    the same way ADR-013's run_scheduled_backups_task iterates tenants."""
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        return
    now = datetime.now(timezone.utc)

    if subscription.status == "trialing" and subscription.trial_ends_at and now >= subscription.trial_ends_at:
        subscription.status = "grace_period"
        subscription.grace_period_ends_at = now + timedelta(days=GRACE_PERIOD_DAYS)
        fire_trigger(db, tenant_id=tenant_id, trigger_type="trial_ending", title="Your trial has ended",
                     message=f"Choose a plan within {GRACE_PERIOD_DAYS} days to keep full access.")
        db.flush()
        return

    if subscription.status == "grace_period" and subscription.grace_period_ends_at and now >= subscription.grace_period_ends_at:
        subscription.status = "expired"
        db.flush()
        return

    if subscription.status == "active" and subscription.cancel_at_period_end and now >= subscription.current_period_end:
        subscription.status = "cancelled"
        db.flush()
        return

    if subscription.status == "active" and now >= subscription.current_period_end:
        plan = db.get(Plan, subscription.plan_id)
        billing_address = get_billing_address(db, tenant_id)
        new_start = subscription.current_period_end
        new_end = period_end(subscription.billing_cycle, new_start)
        generate_invoice(
            db, subscription=subscription, tenant_id=tenant_id,
            tenant_state=billing_address.state if billing_address else None,
            line_items=[(f"{plan.name} subscription renewal", Decimal("1"), _plan_price(plan, subscription.billing_cycle))],
            billing_period_start=new_start.date(), billing_period_end=new_end.date(),
        )
        subscription.current_period_start = new_start
        subscription.current_period_end = new_end
        subscription.status = "past_due"
        db.flush()
        return

    if subscription.status == "past_due" and now >= subscription.current_period_end + timedelta(days=GRACE_PERIOD_DAYS):
        subscription.status = "grace_period"
        subscription.grace_period_ends_at = now + timedelta(days=GRACE_PERIOD_DAYS)
        db.flush()
