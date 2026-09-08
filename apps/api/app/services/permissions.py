"""Platform-global permission catalog (Permission is not tenant-scoped --
see dev.md §64 RBAC). Grown as new modules land in later slices, never
hardcoded as `if plan == ...` checks in a route.

Called from three places, all deliberately: main.py's lifespan (so a
freshly booted API process has it before the first request), directly
inside tenant_signup.py (flush-only here, not commit -- see below --
so a signup is correct even if this is the very first thing to touch
this table, which is exactly what happens in CI: `TestClient(app)`
without a `with` block never runs FastAPI's lifespan, so a migrated-
but-never-booted test database has an empty Permission table until
something calls this explicitly), and defensively inside the
industry-profiles list endpoint's twin function for the same reason.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Permission

RESOURCES = [
    "companies",
    "branches",
    "warehouses",
    "users",
    "roles",
    "financial_years",
    "customers",
    "suppliers",
    "items",
    "imports",
    "stock",
    "approvals",
    "pos",
    "printing",
    "audit",
    "backup",
    "system_health",
    "notification_rules",
    "subscription",
    "billing",
    "employees",
    "employee_compensation",
    "departments",
    "shifts",
    "attendance",
    "leave",
    "payroll",
    "advances",
    "receipts",
]

ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "restore", "manage", "calculate", "lock", "pay"]


def ensure_permission_catalog(db: Session) -> None:
    """Flush-only, not commit -- composable with any caller's own
    transaction (see module docstring). The caller is responsible for
    committing; main.py's lifespan does so explicitly right after."""
    existing = {p.code for p in db.execute(select(Permission)).scalars().all()}
    for resource in RESOURCES:
        for action in ACTIONS:
            code = f"{resource}.{action}"
            if code not in existing:
                db.add(Permission(code=code, resource=resource, action=action))
    db.flush()


def all_permission_codes() -> list[str]:
    return [f"{resource}.{action}" for resource in RESOURCES for action in ACTIONS]
