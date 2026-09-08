"""ADR-014: the pricing catalog seeder, and the entitlement/usage
services every feature check in the app is meant to go through instead
of `if plan == "growth"`.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.subscriptions import Subscription
from app.services.billing_plans import LIMIT_KEYS, ensure_plan_catalog, get_plan_by_slug, list_plans
from app.services.entitlements import effective_limit, has_feature
from app.services.usage import enforce_quota
from app.errors import AppError


def _subscribe(db, tenant_id, plan_slug: str, status: str = "active"):
    plan = get_plan_by_slug(db, plan_slug)
    now = datetime.now(timezone.utc)
    subscription = Subscription(
        tenant_id=tenant_id, plan_id=plan.id, status=status, billing_cycle="monthly",
        current_period_start=now, current_period_end=now + timedelta(days=30),
    )
    db.add(subscription)
    db.flush()
    return subscription


def test_catalog_seeding_is_idempotent(db):
    ensure_plan_catalog(db)
    first = len(list_plans(db, public_only=False))
    ensure_plan_catalog(db)
    second = len(list_plans(db, public_only=False))
    assert first == second
    assert first >= 5  # free, starter, growth, business, professional (+enterprise, not public)
    assert all(key for key in LIMIT_KEYS)  # sanity: the catalog constant isn't empty


def test_free_plan_grants_no_gated_features_growth_grants_pos(db, tenant_ctx):
    ensure_plan_catalog(db)
    tenant_id = tenant_ctx["tenant"].id

    _subscribe(db, tenant_id, "free")
    assert has_feature(db, tenant_id, "module.pos") is False

    db.execute(Subscription.__table__.delete().where(Subscription.tenant_id == tenant_id))
    _subscribe(db, tenant_id, "growth")
    assert has_feature(db, tenant_id, "module.pos") is True
    assert has_feature(db, tenant_id, "module.fleet") is False  # Business+ only


def test_cancelled_subscription_grants_no_features(db, tenant_ctx):
    ensure_plan_catalog(db)
    tenant_id = tenant_ctx["tenant"].id
    _subscribe(db, tenant_id, "growth", status="cancelled")
    assert has_feature(db, tenant_id, "module.pos") is False
    assert effective_limit(db, tenant_id, "users") == 0


def test_effective_limit_unlimited_is_none(db, tenant_ctx):
    ensure_plan_catalog(db)
    tenant_id = tenant_ctx["tenant"].id
    _subscribe(db, tenant_id, "professional")
    assert effective_limit(db, tenant_id, "customers") is None  # Professional: unlimited


def test_enforce_quota_blocks_hard_limit_and_allows_under_it(db, tenant_ctx):
    ensure_plan_catalog(db)
    tenant_id = tenant_ctx["tenant"].id
    _subscribe(db, tenant_id, "free")  # users limit = 2

    enforce_quota(db, tenant_id=tenant_id, limit_key="users", current_count=1)  # 1 -> 2, at the limit, allowed

    try:
        enforce_quota(db, tenant_id=tenant_id, limit_key="users", current_count=2)  # 2 -> 3, over the limit of 2
        assert False, "expected USAGE_LIMIT_EXCEEDED"
    except AppError as exc:
        assert exc.code == "USAGE_LIMIT_EXCEEDED"
        assert exc.status_code == 402
        assert exc.details["limit"] == 2
