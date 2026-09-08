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

# Reused across the profiles below purely to keep 20+ near-identical
# dicts readable -- not a schema, just literal defaults. inventory_flags
# is a free-form JSONB dict (see models/industry.py); any key can be
# added per profile (e.g. serial_tracking for IMEI-driven ones) without
# a migration or a frontend change -- IndustryConfigPage already renders
# whatever keys are present generically.
DEALER_WIDGETS = ["outstanding", "invoiced", "open_sales_orders", "active_items", "active_customers"]
DEALER_WIDGETS_WITH_QUOTES = [
    "outstanding", "invoiced", "open_quotations", "open_sales_orders", "active_items", "active_customers",
]
POS_WIDGETS = ["todays_sales", "todays_cash", "todays_upi", "todays_card", "active_items", "active_customers"]
POS_WIDGETS_COMPACT = ["todays_sales", "todays_cash", "todays_upi", "todays_card", "active_items"]


def _flags(**overrides: bool) -> dict:
    base = {"batch_tracking": False, "expiry_tracking": False, "fefo": False, "weight_tracking": False}
    base.update(overrides)
    return base


# terminology is stored per ADR-010's scope (nav labels + Customer/Item
# page headers) but not yet actually consumed anywhere in the frontend
# beyond displaying it read-only on the Industry Configuration page --
# left {} on every profile below rather than shipping labels nothing
# renders. Wiring it into the sidebar/page headers is a follow-up, not
# a per-profile data problem.
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
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(batch_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "retail",
        "name": "Retail Shop",
        "category": "retail",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "pharmacy",
        "name": "Pharmacy",
        "category": "healthcare",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "near_expiry", "active_items", "active_customers"],
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    # -- The remaining 20 industries from the original brief's list.
    # Each is a plain config entry over the same generic core (sales,
    # inventory, POS, accounting/GST, dynamic attributes) proven by
    # Retail and Pharmacy above -- no migration, no new backend code.
    # Two (Travel, Real Estate) are honestly service/project-oriented,
    # not inventory-item businesses; they get sales/accounting only,
    # no inventory/pos/warehouse modules, rather than a misleading
    # module list. Their deeper domain models (property/unit/booking/
    # payment-schedule; package/itinerary/booking) from the original
    # spec are not built -- backlog, same as the ~19-industry gap this
    # comment used to describe before this batch.
    {
        "slug": "ecommerce",
        "name": "Ecommerce",
        "category": "ecommerce",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "dispatch", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "fmcg",
        "name": "FMCG",
        "category": "distribution",
        "terminology": {},
        "enabled_modules": [
            "sales", "purchase", "inventory", "warehouse", "dispatch",
            "credit", "collections", "field_sales", "accounting", "gst",
        ],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "auto_parts",
        "name": "Auto Parts",
        "category": "automotive",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "food_beverage",
        "name": "Food & Beverages",
        "category": "food",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "near_expiry", "todays_cash", "todays_upi", "todays_card", "active_items"],
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "chemical",
        "name": "Chemical",
        "category": "chemical",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "computer_hardware",
        "name": "Computer Hardware",
        "category": "electronics",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "furniture",
        "name": "Furniture",
        "category": "furniture",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "book_publishing",
        "name": "Book Publishing",
        "category": "publishing",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "travel",
        "name": "Travel",
        "category": "services",
        "terminology": {},
        "enabled_modules": ["sales", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": {},
        "pricing_strategy": "service",
    },
    {
        "slug": "electrical",
        "name": "Electrical",
        "category": "construction",
        "terminology": {},
        "enabled_modules": [
            "sales", "purchase", "inventory", "warehouse", "dispatch",
            "projects", "credit", "collections", "accounting", "gst",
        ],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS_WITH_QUOTES,
        "inventory_flags": _flags(),
        "pricing_strategy": "standard",
    },
    {
        "slug": "paper_mill",
        "name": "Paper Mill",
        "category": "manufacturing",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "dispatch", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "paint",
        "name": "Paint",
        "category": "construction",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "warehouse", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "mobile",
        "name": "Mobile Store",
        "category": "electronics",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "garments",
        "name": "Garments",
        "category": "fashion",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "jewellery",
        "name": "Jewellery",
        "category": "fashion",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "credit", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "active_items", "active_customers"],
        "inventory_flags": _flags(weight_tracking=True, serial_tracking=True),
        # Metal rate + weight + making charges + wastage + stone charges
        # (dev.md sec27) -- informational, like every other pricing_strategy
        # value here; resolve_price() itself is unchanged, still
        # rate-contract > customer-price > standard_price for every profile.
        "pricing_strategy": "weight_making_wastage",
    },
    {
        "slug": "agriculture",
        "name": "Agriculture",
        "category": "agriculture",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": DEALER_WIDGETS,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True, weight_tracking=True),
        "pricing_strategy": "standard",
    },
    {
        "slug": "stationery",
        "name": "Stationery",
        "category": "retail",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "electronics",
        "name": "Electronics",
        "category": "electronics",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["todays_sales", "active_items", "active_customers"],
        "inventory_flags": _flags(serial_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    {
        "slug": "real_estate",
        "name": "Real Estate",
        "category": "services",
        "terminology": {},
        "enabled_modules": ["sales", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": ["outstanding", "invoiced", "open_quotations", "active_customers"],
        "inventory_flags": {},
        "pricing_strategy": "service",
    },
    {
        "slug": "grocery",
        "name": "Grocery",
        "category": "retail",
        "terminology": {},
        "enabled_modules": ["sales", "purchase", "inventory", "pos", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": POS_WIDGETS_COMPACT,
        "inventory_flags": _flags(batch_tracking=True, expiry_tracking=True, fefo=True, weight_tracking=True),
        "pricing_strategy": "pos_mrp_discount",
    },
    # -- Printing Press / Digital Color Lab (ADR-011). Unlike every
    # profile above, this one is NOT config-only: "printing" is a real
    # module backed by new tables (PrintJob/PrintJobArtwork/PrintMachine)
    # and a real job-lifecycle service, because the spec driving it is
    # explicit that a print shop is Customer->Job->Artwork->Prepress->
    # Production->Finishing->QC->Delivery->Invoice->Profitability, not
    # products-in-a-cart -- forcing it through the generic sales/pos
    # module set the way Retail/Grocery/etc. were would have been
    # dishonest, not just under-scoped.
    {
        "slug": "printing_press",
        "name": "Printing Press & Digital Color Lab",
        "category": "printing",
        "terminology": {},
        "enabled_modules": ["printing", "purchase", "inventory", "projects", "credit", "collections", "accounting", "gst"],
        "navigation_config": [],
        "dashboard_widgets": [
            "jobs_due_today", "jobs_overdue", "jobs_in_production", "outstanding", "active_customers",
        ],
        # weight/batch/expiry/fefo don't apply to a print shop's own
        # stock (paper/ink, tracked as ordinary Items) the way they do
        # for a pharmacy or grocer -- left at the _flags() defaults
        # (all False) rather than padded with irrelevant flags.
        "inventory_flags": _flags(),
        "pricing_strategy": "job_costing",
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
