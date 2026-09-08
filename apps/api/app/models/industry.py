from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPk


class IndustryProfile(Base, UUIDPk, TimestampMixin):
    """Platform-level catalog, not tenant data -- like Permission (see
    services/permissions.py), this is shared across every tenant and
    carries no tenant_id, so it needs no RLS policy (B9 only applies to
    tenant-scoped tables).

    A profile is pure configuration: adding a new industry should mean
    adding a row here (via ensure_industry_profile_catalog), not writing
    `if industry == "..."` branches through the app. terminology/
    enabled_modules/navigation_config/dashboard_widgets/inventory_flags
    are read by the frontend to adapt the sidebar, dashboard, item forms
    and labels without a second codebase per industry.
    """

    __tablename__ = "industry_profiles"

    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    # {"customer": "Patient", ...} -- only overridden terms are stored; a
    # key absent here means "use the generic default" (see lib/terminology
    # on the frontend for the default table this overlays).
    terminology: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Module keys gating both sidebar sections/items and route access,
    # e.g. ["sales", "purchase", "inventory", "pos", "projects", ...].
    enabled_modules: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Same shape as the frontend's NavigationSection[] (lib/navigation.ts).
    navigation_config: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # Ordered widget keys for the dashboard registry, e.g.
    # ["outstanding", "todays_sales", "near_expiry", ...].
    dashboard_widgets: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    # {"batch_tracking": bool, "expiry_tracking": bool, "fefo": bool, ...}
    inventory_flags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Informational for now -- resolve_price() itself is unchanged in this
    # phase; this documents intent for a future pricing-strategy switch.
    pricing_strategy: Mapped[str] = mapped_column(String(50), nullable=False, default="standard")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
