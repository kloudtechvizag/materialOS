"""Platform-global industry profile catalog (IndustryProfile is not
tenant-scoped -- see models/industry.py). Seeded once at startup exactly
like the permission catalog (services/permissions.py): a new industry is
a new entry in PROFILE_DEFINITIONS, not a migration or an `if industry ==`
branch anywhere in the app. The `building_materials` row is the one
exception with a matching migration, because it also needs to backfill
every pre-existing Company -- Retail/Pharmacy/future profiles need no
backfill (no company references them yet) and can ship purely as a new
list entry here.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.industry import IndustryProfile

# Mirrors the frontend's default terminology table (lib/terminology.ts) --
# only keys a profile actually overrides need to be listed here.
PROFILE_DEFINITIONS: list[dict] = [
    {
        "slug": "building_materials",
        "name": "Building Materials",
        "category": "construction",
        "terminology": {},
        "enabled_modules": [
            "sales",
            "purchase",
            "inventory",
            "warehouse",
            "dispatch",
            "fleet",
            "credit",
            "collections",
            "projects",
            "field_sales",
            "accounting",
            "gst",
        ],
        # Populated in Slice B to exactly mirror today's static
        # NAVIGATION_CONFIG -- left empty here in Slice A since nothing
        # reads it yet and the shape is owned by the frontend.
        "navigation_config": [],
        "dashboard_widgets": [
            "outstanding",
            "invoiced",
            "open_quotations",
            "open_sales_orders",
            "active_items",
            "active_customers",
        ],
        "inventory_flags": {
            "batch_tracking": True,
            "expiry_tracking": False,
            "fefo": False,
            "weight_tracking": True,
        },
        "pricing_strategy": "standard",
    },
    {
        "slug": "retail",
        "name": "Retail Shop",
        "category": "retail",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": [
            "todays_sales",
            "todays_cash",
            "todays_upi",
            "todays_card",
            "active_items",
            "active_customers",
        ],
        "inventory_flags": {
            "batch_tracking": False,
            "expiry_tracking": False,
            "fefo": False,
            "weight_tracking": False,
        },
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "pharmacy",
        "name": "Pharmacy",
        "category": "healthcare",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": [
            "todays_sales",
            "near_expiry",
            "active_items",
            "active_customers",
        ],
        "inventory_flags": {
            "batch_tracking": True,
            "expiry_tracking": True,
            "fefo": True,
            "weight_tracking": False,
        },
        "pricing_strategy": "pos_mrp_discount",
    },
]


def ensure_industry_profile_catalog(db: Session) -> None:
    existing_slugs = {p.slug for p in db.execute(select(IndustryProfile)).scalars().all()}
    for definition in PROFILE_DEFINITIONS:
        if definition["slug"] not in existing_slugs:
            db.add(IndustryProfile(**definition))
    db.commit()


def get_profile_by_slug(db: Session, slug: str) -> IndustryProfile | None:
    return db.execute(select(IndustryProfile).where(IndustryProfile.slug == slug)).scalar_one_or_none()
