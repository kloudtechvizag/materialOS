"""Platform-level pricing catalog -- Plan/Feature/PlanFeature/PlanLimit
carry no tenant_id and need no RLS, same reasoning as Permission and
IndustryProfile: this is MaterialOS's own product configuration, not
any tenant's data. See app/models/subscriptions.py for the tenant-
scoped side (a specific tenant's Subscription to one of these Plans).
"""
import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class Feature(Base, UUIDPk, TimestampMixin):
    """The feature catalog (spec sec14-15) -- e.g. "inventory.advanced",
    "module.fleet", "ai.demand_forecasting". Grown as new gated
    capabilities land, same pattern as Permission's RESOURCES list."""

    __tablename__ = "features"
    __table_args__ = (UniqueConstraint("code", name="uq_features_code"),)

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Plan(Base, UUIDPk, TimestampMixin):
    """A specific, immutable priced offering. "Version" (spec sec43) is
    modeled as a new Plan row sharing `slug` with a higher `version` --
    a Subscription references one specific Plan row, so a price change
    never silently moves an existing subscriber; `is_current` marks
    which version new signups/upgrades see for a given slug."""

    __tablename__ = "plans"
    __table_args__ = (UniqueConstraint("slug", "version", name="uq_plans_slug_version"),)

    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tier_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # False for Enterprise: no self-serve price/checkout, sales-assisted only.
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # The plan a brand-new tenant lands on at signup, pre-payment (sec26).
    is_default_signup_plan: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    monthly_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    yearly_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    trial_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PlanFeature(Base, UUIDPk, TimestampMixin):
    __tablename__ = "plan_features"
    __table_args__ = (UniqueConstraint("plan_id", "feature_id", name="uq_plan_features"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    feature_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("features.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class AddonOffering(Base, UUIDPk, TimestampMixin):
    """The purchasable add-on catalog (sec21, sec10-11's "Business Plan +
    Printing Pack") -- Plan is to Subscription as AddonOffering is to
    SubscriptionAddon. A tenant's SubscriptionAddon row snapshots this
    offering's price/feature/limit_delta at purchase time (same reasoning
    as Plan versioning: a later price change here must not retroactively
    reprice an addon a tenant already bought)."""

    __tablename__ = "addon_offerings"
    __table_args__ = (UniqueConstraint("code", name="uq_addon_offerings_code"),)

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    feature_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("features.id", ondelete="SET NULL"), nullable=True)
    limit_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    limit_delta: Mapped[int | None] = mapped_column(Integer, nullable=True)
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    yearly_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PlanLimit(Base, UUIDPk, TimestampMixin):
    """`limit_value = NULL` means unlimited (sec16's examples -- e.g.
    Professional's "100+" users -- are modeled as a high number or NULL,
    admin-configurable either way)."""

    __tablename__ = "plan_limits"
    __table_args__ = (UniqueConstraint("plan_id", "limit_key", name="uq_plan_limits"),)

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    limit_key: Mapped[str] = mapped_column(String(50), nullable=False)
    limit_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # sec19: a soft limit warns (via the notification rule engine, ADR-013)
    # but does not block; a hard limit blocks the action server-side.
    is_hard_limit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
