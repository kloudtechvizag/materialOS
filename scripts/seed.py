#!/usr/bin/env python3
"""G6 seed data -- Slice 0 scope only.

Creates the demo tenant (Sri Balaji Building Materials, 3 branches),
its item catalog across the 9 categories named in dev.md, and a handful
of customers/suppliers with opening balances. Deterministic (fixed
random seed), regenerable by re-running against a fresh database.

Explicitly NOT included here: 18 months of transaction history, a
receivables ageing curve, and "three projects mid-delivery" -- those
need SalesOrder/Invoice/Project, which do not exist until Slice 1.
Building them now against tables that don't exist yet would be
fabrication, not seed data. Extend this script once those models land.

Run from apps/api with the venv active:
    DATABASE_URL=... python ../../scripts/seed.py
"""

import random
import sys
import uuid
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.db import SessionLocal, set_session_context  # noqa: E402
from app.models.masters import Customer, Item, Supplier  # noqa: E402
from app.models.numbering import FinancialYear  # noqa: E402
from app.models.tenant import Branch, Company, Tenant, Warehouse  # noqa: E402
from app.models.user import Permission, Role, RolePermission, User, UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402

random.seed(42)

BRANCHES = ["Visakhapatnam", "Vijayawada", "Hyderabad"]

CEMENT_BRANDS = ["UltraTech", "ACC", "Ambuja", "Ramco"]
CEMENT_GRADES = ["OPC 43", "OPC 53", "PPC"]

TMT_BRANDS = ["Tata Tiscon", "JSW", "Vizag Steel"]
TMT_DIAMETERS_MM = [8, 10, 12, 16, 20, 25]

HARDWARE_ITEMS = [
    ("Hinges 4 inch", "Hardware", "8302", "18", "PCS"),
    ("Door Lock Standard", "Hardware", "8301", "18", "PCS"),
    ("Cement Nails 3 inch", "Hardware", "7317", "18", "KG"),
    ("Binding Wire 20 gauge", "Hardware", "7217", "18", "KG"),
]

PLUMBING_ITEMS = [
    ("PVC Pipe 1 inch", "Plumbing", "3917", "18", "MTR"),
    ("PVC Pipe 2 inch", "Plumbing", "3917", "18", "MTR"),
    ("CPVC Elbow 1 inch", "Plumbing", "3917", "18", "PCS"),
    ("Bib Cock Chrome", "Plumbing", "8481", "18", "PCS"),
]

ELECTRICAL_ITEMS = [
    ("Wire 1.5 sqmm", "Electrical", "8544", "18", "MTR"),
    ("Wire 2.5 sqmm", "Electrical", "8544", "18", "MTR"),
    ("MCB 16A", "Electrical", "8536", "18", "PCS"),
    ("Switch Board 4 Module", "Electrical", "8536", "18", "PCS"),
]

TILE_BRANDS = ["Kajaria", "Somany", "Nitco"]
TILE_SIZES = ["2x2 ft", "1x1 ft", "2x4 ft"]

PAINT_ITEMS = [
    ("Asian Paints Emulsion 20L", "Paint", "3209", "18", "LTR"),
    ("Berger Weathercoat 20L", "Paint", "3209", "18", "LTR"),
    ("Primer 4L", "Paint", "3209", "18", "LTR"),
]

SANITARY_ITEMS = [
    ("Wash Basin Standard", "Sanitary", "6910", "18", "PCS"),
    ("Western Commode", "Sanitary", "6910", "18", "PCS"),
    ("Health Faucet", "Sanitary", "8481", "18", "PCS"),
]

CUSTOMER_NAMES = [
    "ABC Constructions", "Green Valley Builders", "Sri Venkateswara Contractors",
    "Ramesh Kumar", "Suresh Reddy", "Kavitha Enterprises", "Balaji Infra Projects",
    "Ganesh Traders", "Lakshmi Constructions", "Sai Builders",
]

SUPPLIER_NAMES = [
    "UltraTech Cement Distributors", "Tata Tiscon Regional Distributors",
    "Kajaria Tiles Depot", "Asian Paints C&F", "JSW Steel Distributors",
    "Ambuja Cement Distributors",
]


def build_items() -> list[dict]:
    items = []
    for brand in CEMENT_BRANDS:
        for grade in CEMENT_GRADES:
            items.append(
                {
                    "sku": f"CEM-{brand[:3].upper()}-{grade.replace(' ', '')}",
                    "name": f"{brand} {grade} 50KG",
                    "hsn_code": "2523",
                    "gst_rate": Decimal("18"),
                    "base_uom": "BAG",
                }
            )
    for brand in TMT_BRANDS:
        for dia in TMT_DIAMETERS_MM:
            items.append(
                {
                    "sku": f"TMT-{brand.split()[0][:3].upper()}-{dia}MM",
                    "name": f"{brand} TMT {dia}mm Fe500D",
                    "hsn_code": "7214",
                    "gst_rate": Decimal("18"),
                    "base_uom": "KG",
                }
            )
    for brand in TILE_BRANDS:
        for size in TILE_SIZES:
            items.append(
                {
                    "sku": f"TILE-{brand[:3].upper()}-{size.replace(' ', '').replace('x', 'X')}",
                    "name": f"{brand} Vitrified Tile {size}",
                    "hsn_code": "6907",
                    "gst_rate": Decimal("18"),
                    "base_uom": "BOX",
                }
            )
    for name, category, hsn, rate, uom in [*HARDWARE_ITEMS, *PLUMBING_ITEMS, *ELECTRICAL_ITEMS, *PAINT_ITEMS, *SANITARY_ITEMS]:
        items.append(
            {
                "sku": f"{category[:3].upper()}-{name.split()[0][:6].upper()}-{random.randint(100, 999)}",
                "name": name,
                "hsn_code": hsn,
                "gst_rate": Decimal(rate),
                "base_uom": uom,
            }
        )
    return items


def main() -> None:
    db = SessionLocal()
    ensure_permission_catalog(db)

    tenant = Tenant(name="Sri Balaji Building Materials", slug="sribalaji-demo")
    db.add(tenant)
    db.flush()
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)

    company = Company(
        tenant_id=tenant.id,
        name="Sri Balaji Building Materials",
        legal_name="Sri Balaji Building Materials Pvt Ltd",
        gstin="37AASCS1234F1Z5",
        financial_year_start_month=4,
    )
    db.add(company)
    db.flush()

    today = date.today()
    fy_start_year = today.year if today.month >= 4 else today.year - 1
    financial_year = FinancialYear(
        tenant_id=tenant.id,
        company_id=company.id,
        code=f"{fy_start_year}-{str(fy_start_year + 1)[-2:]}",
        start_date=date(fy_start_year, 4, 1),
        end_date=date(fy_start_year + 1, 3, 31),
    )
    db.add(financial_year)

    owner_role = Role(tenant_id=tenant.id, name="owner", is_system=True)
    db.add(owner_role)
    db.flush()
    for permission in db.query(Permission).all():
        db.add(RolePermission(tenant_id=tenant.id, role_id=owner_role.id, permission_id=permission.id))

    owner = User(
        tenant_id=tenant.id,
        email="owner@sribalaji-demo.example.com",
        hashed_password=hash_password("demo-password-123"),
        full_name="Balaji Rao",
    )
    db.add(owner)
    db.flush()
    db.add(UserRole(tenant_id=tenant.id, user_id=owner.id, role_id=owner_role.id, branch_id=None))

    for branch_name in BRANCHES:
        branch = Branch(
            tenant_id=tenant.id,
            company_id=company.id,
            name=branch_name,
            code=branch_name[:3].upper(),
            city=branch_name,
            state="Andhra Pradesh" if branch_name != "Hyderabad" else "Telangana",
        )
        db.add(branch)
        db.flush()
        db.add(Warehouse(tenant_id=tenant.id, branch_id=branch.id, name=f"{branch_name} Godown", code=f"{branch.code}-WH"))

    for item_data in build_items():
        db.add(Item(tenant_id=tenant.id, company_id=company.id, is_active=True, **item_data))

    for i, name in enumerate(CUSTOMER_NAMES):
        db.add(
            Customer(
                tenant_id=tenant.id,
                company_id=company.id,
                name=name,
                phone=f"9{random.randint(100000000, 999999999)}",
                credit_limit=Decimal(random.choice([200000, 500000, 1000000, 1500000])),
                credit_days=random.choice([15, 30, 45]),
                opening_balance=Decimal(random.randint(0, 250000)),
                opening_balance_as_of=today - timedelta(days=random.randint(1, 60)),
            )
        )

    for name in SUPPLIER_NAMES:
        db.add(
            Supplier(
                tenant_id=tenant.id,
                company_id=company.id,
                name=name,
                opening_balance=Decimal(random.randint(0, 500000)),
                opening_balance_as_of=today - timedelta(days=random.randint(1, 60)),
            )
        )

    db.commit()
    print(f"Seeded tenant '{tenant.slug}' ({tenant.id}).")
    print(f"Owner login: owner@sribalaji-demo.example.com / demo-password-123")
    db.close()


if __name__ == "__main__":
    main()
