"""Platform-global permission catalog (Permission is not tenant-scoped --
see dev.md §64 RBAC). Seeded once at startup; grown as new modules land
in later slices, never hardcoded as `if plan == ...` checks in a route.
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
]

ACTIONS = ["view", "create", "edit", "delete", "approve", "export"]


def ensure_permission_catalog(db: Session) -> None:
    existing = {p.code for p in db.execute(select(Permission)).scalars().all()}
    for resource in RESOURCES:
        for action in ACTIONS:
            code = f"{resource}.{action}"
            if code not in existing:
                db.add(Permission(code=code, resource=resource, action=action))
    db.commit()


def all_permission_codes() -> list[str]:
    return [f"{resource}.{action}" for resource in RESOURCES for action in ACTIONS]
