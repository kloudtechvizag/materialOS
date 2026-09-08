"""ADR-014: the platform pricing catalog -- features, plans (with their
feature grants and usage limits), and purchasable add-on offerings.
Seeded once, idempotently, the same pattern as
services/permissions.py::ensure_permission_catalog and
services/industry.py::ensure_industry_profile_catalog: a new plan or
feature is a new entry in the lists below, never a migration and never
an `if plan == "growth"` branch anywhere else in the app (spec sec82).

Prices/limits here are illustrative defaults matching the spec's own
examples -- real numbers are an admin/business decision, not something
this pass invents authoritatively. They live in the `plans`/
`plan_limits` tables precisely so they're editable without a code
change once a real pricing console exists (see ADR-014's deferred
list).
"""

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.billing_plans import AddonOffering, Feature, Plan, PlanFeature, PlanLimit

# ------------------------------------------------------------- Features (spec sec14-15)

FEATURE_CATALOG: list[dict] = [
    {"code": "module.warehouse", "name": "Warehouse & stock transfers", "category": "warehouse"},
    {"code": "module.dispatch", "name": "Dispatch board", "category": "dispatch"},
    {"code": "module.fleet", "name": "Fleet & delivery", "category": "fleet"},
    {"code": "module.collections", "name": "Collections & ageing", "category": "collections"},
    {"code": "module.field_sales", "name": "Field sales check-in", "category": "field_sales"},
    {"code": "module.projects", "name": "Project / site management", "category": "projects"},
    {"code": "module.approvals", "name": "Approval workflows", "category": "automation"},
    {"code": "module.printing", "name": "Printing & Digital Color Lab", "category": "printing"},
    {"code": "module.pos", "name": "Point of sale", "category": "pos"},
    {"code": "inventory.advanced", "name": "Advanced inventory", "category": "inventory"},
    {"code": "inventory.batch_tracking", "name": "Batch tracking", "category": "inventory"},
    {"code": "inventory.serial_tracking", "name": "Serial numbers", "category": "inventory"},
    {"code": "inventory.barcode", "name": "Barcode scanning", "category": "inventory"},
    {"code": "pricing.price_lists", "name": "Price lists", "category": "sales"},
    {"code": "pricing.customer_specific", "name": "Customer-specific pricing", "category": "sales"},
    {"code": "credit.management", "name": "Customer credit management", "category": "crm"},
    {"code": "accounting.advanced", "name": "Advanced accounting & cost centers", "category": "accounting"},
    {"code": "gst.advanced", "name": "Advanced GST filing", "category": "gst"},
    {"code": "reports.advanced", "name": "Advanced reports", "category": "reports"},
    {"code": "reports.custom", "name": "Custom reports", "category": "reports"},
    {"code": "analytics.advanced", "name": "Advanced analytics", "category": "analytics"},
    {"code": "analytics.custom_dashboards", "name": "Custom dashboards", "category": "analytics"},
    {"code": "ai.assistant", "name": "AI assistant", "category": "ai"},
    {"code": "ai.forecasting", "name": "AI demand forecasting", "category": "ai"},
    {"code": "ai.copilot", "name": "AI business copilot", "category": "ai"},
    {"code": "api.basic", "name": "API access", "category": "api"},
    {"code": "api.webhooks", "name": "Webhooks", "category": "api"},
    {"code": "security.advanced_permissions", "name": "Advanced permissions", "category": "security"},
    {"code": "security.sso", "name": "Single sign-on", "category": "security"},
    {"code": "security.advanced_audit", "name": "Advanced audit", "category": "security"},
    {"code": "backup.automated", "name": "Automated backups", "category": "backup"},
    {"code": "backup.long_retention", "name": "Long-retention backups", "category": "backup"},
    {"code": "notifications.advanced", "name": "Advanced notification rules", "category": "automation"},
    {"code": "workflow.automation", "name": "Workflow automation", "category": "automation"},
    {"code": "support.priority", "name": "Priority support", "category": "support"},
    {"code": "support.sla", "name": "SLA-backed support", "category": "support"},
]

LIMIT_KEYS = [
    "users", "companies", "branches", "warehouses", "customers", "suppliers", "items",
    "invoices_per_month", "purchase_orders_per_month", "sales_orders_per_month",
    "api_calls_per_month", "storage_gb", "ai_requests_per_month",
]

# Only "users" and "invoices_per_month" are actually enforced server-side
# today (services/usage.py's two real call sites -- user creation and
# invoice creation). Every other key is real, admin-visible configuration
# and shows on the usage dashboard, but is honestly not yet a blocking
# gate -- see ADR-014's deferred list rather than silently claiming
# enforcement that doesn't exist.
ENFORCED_LIMIT_KEYS = {"users", "invoices_per_month"}

_UNLIMITED = None


def _limits(**overrides: int | None) -> dict:
    base = {k: _UNLIMITED for k in LIMIT_KEYS}
    base.update(overrides)
    return base


PLAN_DEFINITIONS: list[dict] = [
    {
        "slug": "free", "name": "Free", "tier_order": 0, "is_public": True, "is_default_signup_plan": False,
        "monthly_price": Decimal("0"), "yearly_price": Decimal("0"), "trial_days": 0,
        "description": "Try MaterialOS with a single company and a small team.",
        "features": [],
        "limits": _limits(
            users=2, companies=1, branches=1, warehouses=1, customers=500, suppliers=100, items=1000,
            invoices_per_month=500, purchase_orders_per_month=100, sales_orders_per_month=100,
            api_calls_per_month=0, storage_gb=1, ai_requests_per_month=50,
        ),
    },
    {
        "slug": "starter", "name": "Starter", "tier_order": 1, "is_public": True, "is_default_signup_plan": False,
        "monthly_price": Decimal("1499"), "yearly_price": Decimal("14390"), "trial_days": 14,
        "description": "For small shops, retailers, and small dealers.",
        "features": ["module.pos"],
        "limits": _limits(
            users=3, companies=1, branches=1, warehouses=2, customers=2000, suppliers=500, items=5000,
            invoices_per_month=2000, purchase_orders_per_month=500, sales_orders_per_month=500,
            api_calls_per_month=0, storage_gb=10, ai_requests_per_month=200,
        ),
    },
    {
        "slug": "growth", "name": "Growth", "tier_order": 2, "is_public": True, "is_default_signup_plan": True,
        "monthly_price": Decimal("3999"), "yearly_price": Decimal("38390"), "trial_days": 14,
        "description": "For growing businesses that need multi-branch and stock control.",
        "features": [
            "module.pos", "module.warehouse", "module.approvals", "module.collections", "module.field_sales",
            "inventory.advanced", "inventory.batch_tracking", "inventory.serial_tracking", "inventory.barcode",
            "reports.advanced", "credit.management", "notifications.advanced", "backup.automated", "ai.assistant",
        ],
        "limits": _limits(
            users=10, companies=3, branches=3, warehouses=5, customers=10000, suppliers=2000, items=25000,
            invoices_per_month=10000, purchase_orders_per_month=2000, sales_orders_per_month=2000,
            api_calls_per_month=5000, storage_gb=50, ai_requests_per_month=2000,
        ),
    },
    {
        "slug": "business", "name": "Business", "tier_order": 3, "is_public": True, "is_default_signup_plan": False,
        "monthly_price": Decimal("8999"), "yearly_price": Decimal("86390"), "trial_days": 14,
        "description": "For established businesses running multiple warehouses and dispatch.",
        "features": [
            "module.pos", "module.warehouse", "module.approvals", "module.collections", "module.field_sales",
            "module.dispatch", "module.fleet", "module.projects",
            "inventory.advanced", "inventory.batch_tracking", "inventory.serial_tracking", "inventory.barcode",
            "pricing.price_lists", "pricing.customer_specific", "credit.management",
            "accounting.advanced", "gst.advanced", "reports.advanced", "reports.custom",
            "notifications.advanced", "backup.automated", "backup.long_retention",
            "ai.assistant", "workflow.automation", "api.basic",
        ],
        "limits": _limits(
            users=25, companies=10, branches=10, warehouses=20, customers=50000, suppliers=10000, items=100000,
            invoices_per_month=50000, purchase_orders_per_month=10000, sales_orders_per_month=10000,
            api_calls_per_month=50000, storage_gb=250, ai_requests_per_month=10000,
        ),
    },
    {
        "slug": "professional", "name": "Professional", "tier_order": 4, "is_public": True, "is_default_signup_plan": False,
        "monthly_price": Decimal("17999"), "yearly_price": Decimal("172790"), "trial_days": 14,
        "description": "For larger organizations that need advanced AI, analytics, and API access.",
        "features": [
            "module.pos", "module.warehouse", "module.approvals", "module.collections", "module.field_sales",
            "module.dispatch", "module.fleet", "module.projects",
            "inventory.advanced", "inventory.batch_tracking", "inventory.serial_tracking", "inventory.barcode",
            "pricing.price_lists", "pricing.customer_specific", "credit.management",
            "accounting.advanced", "gst.advanced", "reports.advanced", "reports.custom",
            "analytics.advanced", "analytics.custom_dashboards",
            "notifications.advanced", "backup.automated", "backup.long_retention",
            "ai.assistant", "ai.forecasting", "ai.copilot", "workflow.automation",
            "api.basic", "api.webhooks", "security.advanced_permissions", "security.advanced_audit",
            "support.priority",
        ],
        "limits": _limits(
            users=100, companies=50, branches=50, warehouses=100, customers=_UNLIMITED, suppliers=_UNLIMITED,
            items=_UNLIMITED, invoices_per_month=_UNLIMITED, purchase_orders_per_month=_UNLIMITED,
            sales_orders_per_month=_UNLIMITED, api_calls_per_month=500000, storage_gb=1000, ai_requests_per_month=50000,
        ),
    },
    {
        "slug": "enterprise", "name": "Enterprise", "tier_order": 5, "is_public": False, "is_default_signup_plan": False,
        "monthly_price": None, "yearly_price": None, "trial_days": 0,
        "description": "Custom limits, SSO/SCIM, dedicated support, and private deployment options.",
        "features": [f["code"] for f in FEATURE_CATALOG],  # everything
        "limits": _limits(),  # every key unlimited/custom
    },
]

ADDON_CATALOG: list[dict] = [
    {
        "code": "addon.printing_pack", "name": "Printing & Digital Color Lab Pack", "category": "printing",
        "description": "Print jobs, artwork approval, production board, and machine management (spec sec10-11).",
        "feature_code": "module.printing", "limit_key": None, "limit_delta": None,
        "monthly_price": Decimal("1999"), "yearly_price": Decimal("19190"),
    },
    {
        "code": "addon.extra_users_5", "name": "5 Additional Users", "category": "core",
        "description": "Raise your plan's user limit by 5 seats.",
        "feature_code": None, "limit_key": "users", "limit_delta": 5,
        "monthly_price": Decimal("799"), "yearly_price": Decimal("7670"),
    },
    {
        "code": "addon.extra_storage_50gb", "name": "50 GB Additional Storage", "category": "core",
        "description": "Raise your plan's storage limit by 50 GB.",
        "feature_code": None, "limit_key": "storage_gb", "limit_delta": 50,
        "monthly_price": Decimal("499"), "yearly_price": Decimal("4790"),
    },
    {
        "code": "addon.advanced_ai", "name": "Advanced AI", "category": "ai",
        "description": "AI forecasting and business copilot, without moving up a full plan tier.",
        "feature_code": "ai.forecasting", "limit_key": None, "limit_delta": None,
        "monthly_price": Decimal("2499"), "yearly_price": Decimal("23990"),
    },
    {
        "code": "addon.premium_support", "name": "Premium Support", "category": "support",
        "description": "SLA-backed priority support.",
        "feature_code": "support.sla", "limit_key": None, "limit_delta": None,
        "monthly_price": Decimal("1499"), "yearly_price": Decimal("14390"),
    },
]


def ensure_plan_catalog(db: Session) -> None:
    """Flush-only, not commit -- same composability reasoning as every
    other catalog seeder in this codebase (see module docstring)."""
    features_by_code = {f.code: f for f in db.execute(select(Feature)).scalars().all()}
    for definition in FEATURE_CATALOG:
        if definition["code"] not in features_by_code:
            feature = Feature(**definition)
            db.add(feature)
            db.flush()
            features_by_code[feature.code] = feature

    existing_plan_keys = {(p.slug, p.version) for p in db.execute(select(Plan)).scalars().all()}
    plans_by_slug: dict[str, Plan] = {p.slug: p for p in db.execute(select(Plan)).scalars().all() if p.is_current}
    for definition in PLAN_DEFINITIONS:
        key = (definition["slug"], 1)
        if key in existing_plan_keys:
            continue
        plan = Plan(
            slug=definition["slug"], version=1, is_current=True, name=definition["name"],
            description=definition["description"], tier_order=definition["tier_order"],
            is_active=True, is_public=definition["is_public"], is_default_signup_plan=definition["is_default_signup_plan"],
            currency="INR", monthly_price=definition["monthly_price"], yearly_price=definition["yearly_price"],
            trial_days=definition["trial_days"],
        )
        db.add(plan)
        db.flush()
        plans_by_slug[plan.slug] = plan

        for feature_code in definition["features"]:
            db.add(PlanFeature(plan_id=plan.id, feature_id=features_by_code[feature_code].id, is_enabled=True))
        for limit_key, limit_value in definition["limits"].items():
            db.add(PlanLimit(
                plan_id=plan.id, limit_key=limit_key, limit_value=limit_value,
                is_hard_limit=limit_key in ENFORCED_LIMIT_KEYS,
            ))

    existing_addon_codes = {a.code for a in db.execute(select(AddonOffering)).scalars().all()}
    for definition in ADDON_CATALOG:
        if definition["code"] in existing_addon_codes:
            continue
        feature_id = features_by_code[definition["feature_code"]].id if definition["feature_code"] else None
        db.add(AddonOffering(
            code=definition["code"], name=definition["name"], description=definition["description"],
            category=definition["category"], feature_id=feature_id, limit_key=definition["limit_key"],
            limit_delta=definition["limit_delta"], monthly_price=definition["monthly_price"],
            yearly_price=definition["yearly_price"], is_active=True,
        ))

    db.flush()


def list_plans(db: Session, *, public_only: bool = True) -> list[Plan]:
    stmt = select(Plan).where(Plan.is_current == True, Plan.is_active == True).order_by(Plan.tier_order)  # noqa: E712
    if public_only:
        stmt = stmt.where(Plan.is_public == True)  # noqa: E712
    return db.execute(stmt).scalars().all()


def get_plan_by_slug(db: Session, slug: str) -> Plan | None:
    return db.execute(
        select(Plan).where(Plan.slug == slug, Plan.is_current == True)  # noqa: E712
    ).scalar_one_or_none()


def get_default_signup_plan(db: Session) -> Plan | None:
    return db.execute(
        select(Plan).where(Plan.is_default_signup_plan == True, Plan.is_current == True)  # noqa: E712
    ).scalar_one_or_none()


def list_features(db: Session) -> list[Feature]:
    return db.execute(select(Feature).order_by(Feature.category, Feature.name)).scalars().all()


def list_addon_offerings(db: Session) -> list[AddonOffering]:
    return db.execute(select(AddonOffering).where(AddonOffering.is_active == True).order_by(AddonOffering.category, AddonOffering.name)).scalars().all()  # noqa: E712


def compare_plans(db: Session) -> dict:
    """Backend-computed feature/limit matrix for the pricing page's
    "Compare Plans" table (spec sec13) -- never hardcoded in React."""
    plans = list_plans(db, public_only=True) + (
        [get_plan_by_slug(db, "enterprise")] if get_plan_by_slug(db, "enterprise") else []
    )
    features = list_features(db)

    plan_feature_rows = db.execute(select(PlanFeature)).scalars().all()
    enabled_by_plan: dict = {}
    for row in plan_feature_rows:
        if row.is_enabled:
            enabled_by_plan.setdefault(row.plan_id, set()).add(row.feature_id)

    plan_limit_rows = db.execute(select(PlanLimit)).scalars().all()
    limits_by_plan: dict = {}
    for row in plan_limit_rows:
        limits_by_plan.setdefault(row.plan_id, {})[row.limit_key] = row.limit_value

    return {
        "plans": [{"id": str(p.id), "slug": p.slug, "name": p.name} for p in plans],
        "limits": [
            {"limit_key": key, "values": {str(p.id): limits_by_plan.get(p.id, {}).get(key) for p in plans}}
            for key in LIMIT_KEYS
        ],
        "features": [
            {
                "code": f.code, "name": f.name, "category": f.category,
                "values": {str(p.id): f.id in enabled_by_plan.get(p.id, set()) for p in plans},
            }
            for f in features
        ],
    }
