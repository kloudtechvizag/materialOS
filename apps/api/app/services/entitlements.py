"""ADR-014: the single, central place every feature/limit check in the
app goes through -- hasFeature()/hasLimit(), never `if plan == "growth"`
scattered through route handlers (spec sec14, sec82).
"""
import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db_tenant
from app.errors import AppError, ErrorCode
from app.models.billing_plans import Feature, PlanFeature, PlanLimit
from app.models.subscriptions import Subscription, SubscriptionAddon
from app.models.user import User

# spec sec47/sec29: a subscription in one of these states still grants
# its plan's entitlements. past_due/grace_period are deliberately
# included -- "New transactional activity may be restricted according
# to policy" (sec29) is enforced by the *usage* limits, not by pulling
# every feature out from under a tenant the moment a renewal is late.
ENTITLED_STATUSES = {"trialing", "active", "past_due", "grace_period"}


def get_subscription(db: Session, tenant_id: uuid.UUID) -> Subscription | None:
    return db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant_id).order_by(Subscription.created_at.desc())
    ).scalars().first()


def has_feature(db: Session, tenant_id: uuid.UUID, feature_code: str) -> bool:
    subscription = get_subscription(db, tenant_id)
    if subscription is None or subscription.status not in ENTITLED_STATUSES:
        return False

    feature = db.execute(select(Feature).where(Feature.code == feature_code)).scalar_one_or_none()
    if feature is None:
        return False

    granted = db.execute(
        select(PlanFeature.id).where(
            PlanFeature.plan_id == subscription.plan_id,
            PlanFeature.feature_id == feature.id,
            PlanFeature.is_enabled == True,  # noqa: E712
        )
    ).first()
    if granted is not None:
        return True

    via_addon = db.execute(
        select(SubscriptionAddon.id).where(
            SubscriptionAddon.subscription_id == subscription.id,
            SubscriptionAddon.feature_id == feature.id,
            SubscriptionAddon.is_active == True,  # noqa: E712
        )
    ).first()
    return via_addon is not None


def has_module(db: Session, tenant_id: uuid.UUID, module: str) -> bool:
    return has_feature(db, tenant_id, f"module.{module}")


def effective_limit(db: Session, tenant_id: uuid.UUID, limit_key: str) -> int | None:
    """None means unlimited. Returns 0 (nothing allowed) if there is no
    entitled subscription at all -- distinct from "unlimited"."""
    subscription = get_subscription(db, tenant_id)
    if subscription is None or subscription.status not in ENTITLED_STATUSES:
        return 0

    plan_limit = db.execute(
        select(PlanLimit).where(PlanLimit.plan_id == subscription.plan_id, PlanLimit.limit_key == limit_key)
    ).scalar_one_or_none()
    base = plan_limit.limit_value if plan_limit else None
    if base is None:
        return None

    addon_deltas = db.execute(
        select(SubscriptionAddon.limit_delta).where(
            SubscriptionAddon.subscription_id == subscription.id,
            SubscriptionAddon.limit_key == limit_key,
            SubscriptionAddon.is_active == True,  # noqa: E712
        )
    ).scalars().all()
    return base + sum(d for d in addon_deltas if d)


def is_hard_limit(db: Session, tenant_id: uuid.UUID, limit_key: str) -> bool:
    subscription = get_subscription(db, tenant_id)
    if subscription is None:
        return True
    plan_limit = db.execute(
        select(PlanLimit).where(PlanLimit.plan_id == subscription.plan_id, PlanLimit.limit_key == limit_key)
    ).scalar_one_or_none()
    return plan_limit.is_hard_limit if plan_limit else False


def require_feature(feature_code: str):
    """FastAPI dependency -- <FeatureGate/>'s server-side twin. 402, not
    403: this isn't a permissions problem (RBAC), it's a "not on your
    plan" problem, and the frontend's ApiError.code check (spec sec55's
    in-app upgrade experience) branches on that distinction."""

    def _check(db: Session = Depends(get_db_tenant), user: User = Depends(get_current_user)) -> User:
        if not has_feature(db, user.tenant_id, feature_code):
            raise AppError(
                ErrorCode.FEATURE_NOT_AVAILABLE,
                f"This feature ({feature_code}) is not included in your current plan.",
                status_code=402,
                details={"feature": feature_code},
            )
        return user

    return _check
