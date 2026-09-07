#!/usr/bin/env python3
"""G6 seed data -- Slice 0 + Slice 1 scope.

Creates the demo tenant (Sri Balaji Building Materials, 3 branches),
its item catalog with real prices/costs and opening stock, customers
and suppliers with opening balances, a few projects/sites, and a
handful of quotations walked through every real pipeline stage
(draft, approved, reserved, dispatched, invoiced, paid, overdue) so the
dashboard looks alive on first login.

Deliberately NOT included: 18 months of backdated transaction history
or a receivables ageing curve spanning months. Every document here is
created through the same service functions the API uses, which post a
real journal entry and a real stock ledger movement dated today --
hand-fabricating a 6-months-ago invoice_date on top of a today-dated
journal/ledger entry would be exactly the kind of drift B5/B6/B12 exist
to catch, not "seed data." A believable ageing curve needs backdating
support in the domain functions themselves; add it there first, then
extend this script.

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
from app.models.projects import Project, Site  # noqa: E402
from app.models.tenant import Branch, Company, Tenant, Warehouse  # noqa: E402
from app.models.user import Permission, Role, RolePermission, User, UserRole  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.accounts import ensure_default_accounts  # noqa: E402
from app.services.dispatch import create_delivery_challan  # noqa: E402
from app.services.inventory import apply_ledger_movement  # noqa: E402
from app.services.invoicing import create_invoice_from_challan  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402
from app.services.quotation import create_quotation  # noqa: E402
from app.services.receipts import record_receipt  # noqa: E402
from app.services.sales_order import create_sales_order_from_quotation  # noqa: E402

random.seed(42)

BRANCHES = ["Visakhapatnam", "Vijayawada", "Hyderabad"]

CEMENT_BRANDS = ["UltraTech", "ACC", "Ambuja", "Ramco"]
CEMENT_GRADES = ["OPC 43", "OPC 53", "PPC"]

TMT_BRANDS = ["Tata Tiscon", "JSW", "Vizag Steel"]
TMT_DIAMETERS_MM = [8, 10, 12, 16, 20, 25]

HARDWARE_ITEMS = [
    ("Hinges 4 inch", "Hardware", "8302", "18", "PCS", 40, 55),
    ("Door Lock Standard", "Hardware", "8301", "18", "PCS", 250, 350),
    ("Cement Nails 3 inch", "Hardware", "7317", "18", "KG", 80, 95),
    ("Binding Wire 20 gauge", "Hardware", "7217", "18", "KG", 65, 78),
]

PLUMBING_ITEMS = [
    ("PVC Pipe 1 inch", "Plumbing", "3917", "18", "MTR", 45, 60),
    ("PVC Pipe 2 inch", "Plumbing", "3917", "18", "MTR", 95, 120),
    ("CPVC Elbow 1 inch", "Plumbing", "3917", "18", "PCS", 25, 35),
    ("Bib Cock Chrome", "Plumbing", "8481", "18", "PCS", 180, 240),
]

ELECTRICAL_ITEMS = [
    ("Wire 1.5 sqmm", "Electrical", "8544", "18", "MTR", 12, 16),
    ("Wire 2.5 sqmm", "Electrical", "8544", "18", "MTR", 18, 24),
    ("MCB 16A", "Electrical", "8536", "18", "PCS", 90, 120),
    ("Switch Board 4 Module", "Electrical", "8536", "18", "PCS", 140, 180),
]

TILE_BRANDS = ["Kajaria", "Somany", "Nitco"]
TILE_SIZES = ["2x2 ft", "1x1 ft", "2x4 ft"]

PAINT_ITEMS = [
    ("Asian Paints Emulsion 20L", "Paint", "3209", "18", "LTR", 2800, 3400),
    ("Berger Weathercoat 20L", "Paint", "3209", "18", "LTR", 3200, 3900),
    ("Primer 4L", "Paint", "3209", "18", "LTR", 450, 600),
]

SANITARY_ITEMS = [
    ("Wash Basin Standard", "Sanitary", "6910", "18", "PCS", 650, 900),
    ("Western Commode", "Sanitary", "6910", "18", "PCS", 3200, 4200),
    ("Health Faucet", "Sanitary", "8481", "18", "PCS", 320, 420),
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
            cost = Decimal(random.randint(295, 330))
            items.append(
                {
                    "sku": f"CEM-{brand[:3].upper()}-{grade.replace(' ', '')}",
                    "name": f"{brand} {grade} 50KG",
                    "hsn_code": "2523",
                    "gst_rate": Decimal("18"),
                    "base_uom": "BAG",
                    "standard_cost": cost,
                    "standard_price": (cost * Decimal("1.15")).quantize(Decimal("1")),
                    "opening_qty": Decimal(random.randint(300, 2000)),
                }
            )
    for brand in TMT_BRANDS:
        for dia in TMT_DIAMETERS_MM:
            cost = Decimal(random.randint(55, 65))
            items.append(
                {
                    "sku": f"TMT-{brand.split()[0][:3].upper()}-{dia}MM",
                    "name": f"{brand} TMT {dia}mm Fe500D",
                    "hsn_code": "7214",
                    "gst_rate": Decimal("18"),
                    "base_uom": "KG",
                    "standard_cost": cost,
                    "standard_price": (cost * Decimal("1.12")).quantize(Decimal("1")),
                    "opening_qty": Decimal(random.randint(1000, 8000)),
                }
            )
    for brand in TILE_BRANDS:
        for size in TILE_SIZES:
            cost = Decimal(random.randint(280, 420))
            items.append(
                {
                    "sku": f"TILE-{brand[:3].upper()}-{size.replace(' ', '').replace('x', 'X')}",
                    "name": f"{brand} Vitrified Tile {size}",
                    "hsn_code": "6907",
                    "gst_rate": Decimal("18"),
                    "base_uom": "BOX",
                    "standard_cost": cost,
                    "standard_price": (cost * Decimal("1.20")).quantize(Decimal("1")),
                    "opening_qty": Decimal(random.randint(50, 400)),
                }
            )
    for name, category, hsn, rate, uom, cost_lo, cost_hi in [
        *HARDWARE_ITEMS, *PLUMBING_ITEMS, *ELECTRICAL_ITEMS, *PAINT_ITEMS, *SANITARY_ITEMS
    ]:
        cost = Decimal(random.randint(cost_lo, cost_hi))
        items.append(
            {
                "sku": f"{category[:3].upper()}-{name.split()[0][:6].upper()}-{random.randint(100, 999)}",
                "name": name,
                "hsn_code": hsn,
                "gst_rate": Decimal(rate),
                "base_uom": uom,
                "standard_cost": cost,
                "standard_price": (cost * Decimal("1.25")).quantize(Decimal("1")),
                "opening_qty": Decimal(random.randint(20, 300)),
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
        state="Andhra Pradesh",
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
    db.flush()

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

    ensure_default_accounts(db, tenant_id=tenant.id, company_id=company.id)

    warehouses = {}
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
        warehouse = Warehouse(tenant_id=tenant.id, branch_id=branch.id, name=f"{branch_name} Godown", code=f"{branch.code}-WH")
        db.add(warehouse)
        db.flush()
        warehouses[branch_name] = (branch, warehouse)

    main_branch, main_warehouse = warehouses["Visakhapatnam"]

    items_by_sku = {}
    for item_data in build_items():
        opening_qty = item_data.pop("opening_qty")
        item = Item(tenant_id=tenant.id, company_id=company.id, is_active=True, **item_data)
        db.add(item)
        db.flush()
        apply_ledger_movement(
            db, tenant_id=tenant.id, warehouse_id=main_warehouse.id, item_id=item.id,
            qty=opening_qty, rate=item.standard_cost, movement_type="opening",
            reference_type="seed_script", reference_id=uuid.uuid4(), user_id=owner.id,
        )
        items_by_sku[item.sku] = item

    customers_by_name = {}
    for name in CUSTOMER_NAMES:
        customer = Customer(
            tenant_id=tenant.id,
            company_id=company.id,
            name=name,
            billing_state="Andhra Pradesh",
            phone=f"9{random.randint(100000000, 999999999)}",
            credit_limit=Decimal(random.choice([1000000, 1500000, 2000000, 2500000])),
            credit_days=random.choice([15, 30, 45]),
            opening_balance=Decimal(random.randint(0, 100000)),
            opening_balance_as_of=today - timedelta(days=random.randint(1, 60)),
        )
        db.add(customer)
        db.flush()
        customers_by_name[name] = customer

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

    # -- Three projects mid-delivery (G6), each with one site --
    projects = {}
    for customer_name, project_name, site_city in [
        ("ABC Constructions", "Green Valley Apartments", "Visakhapatnam"),
        ("Balaji Infra Projects", "Riverside Towers", "Vijayawada"),
        ("Kavitha Enterprises", "Sunrise Layout", "Visakhapatnam"),
    ]:
        project = Project(tenant_id=tenant.id, customer_id=customers_by_name[customer_name].id, name=project_name)
        db.add(project)
        db.flush()
        site = Site(tenant_id=tenant.id, project_id=project.id, name=f"{site_city} Site", city=site_city, state="Andhra Pradesh")
        db.add(site)
        db.flush()
        projects[project_name] = (project, site)

    cement_sku = "CEM-ULT-OPC53"
    tmt_sku = "TMT-TAT-12MM"

    def make_quotation(customer_name, lines, project_name=None):
        project, site = projects.get(project_name, (None, None))
        return create_quotation(
            db,
            tenant_id=tenant.id, company_id=company.id, branch_id=main_branch.id,
            financial_year_id=financial_year.id, customer_id=customers_by_name[customer_name].id,
            project_id=project.id if project else None, site_id=site.id if site else None,
            site_state=site.state if site else None, valid_until=today + timedelta(days=15),
            lines=lines,
        )

    # 1. ABC Constructions / Green Valley -- the golden transaction, fully closed with a part-payment.
    q1 = make_quotation(
        "ABC Constructions",
        [{"item_id": items_by_sku[cement_sku].id, "qty": Decimal("500"), "uom": "BAG"},
         {"item_id": items_by_sku[tmt_sku].id, "qty": Decimal("2000"), "uom": "KG"}],
        project_name="Green Valley Apartments",
    )
    q1.status = "approved"
    db.flush()
    so1 = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=q1.id, warehouse_id=main_warehouse.id, financial_year_id=financial_year.id,
    )
    dc1 = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=so1.id, financial_year_id=financial_year.id, user_id=owner.id)
    inv1 = create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=dc1.id, financial_year_id=financial_year.id)
    record_receipt(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=main_branch.id, financial_year_id=financial_year.id,
        customer_id=customers_by_name["ABC Constructions"].id, amount=(inv1.total / 2).quantize(Decimal("1")),
        mode="bank", reference_note="Advance", invoice_id=inv1.id,
    )

    # 2. Ramesh Kumar -- quotation still in draft (open pipeline).
    make_quotation("Ramesh Kumar", [{"item_id": items_by_sku["CEM-ACC-OPC43"].id, "qty": Decimal("100"), "uom": "BAG"}])

    # 3. Sri Venkateswara Contractors -- approved but not yet converted.
    q3 = make_quotation("Sri Venkateswara Contractors", [{"item_id": items_by_sku["TMT-JSW-16MM"].id, "qty": Decimal("1500"), "uom": "KG"}])
    q3.status = "approved"
    db.flush()

    # 4. Kavitha Enterprises / Sunrise Layout -- dispatched but not yet invoiced.
    q4 = make_quotation(
        "Kavitha Enterprises",
        [{"item_id": items_by_sku[cement_sku].id, "qty": Decimal("200"), "uom": "BAG"}],
        project_name="Sunrise Layout",
    )
    q4.status = "approved"
    db.flush()
    so4 = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=q4.id, warehouse_id=main_warehouse.id, financial_year_id=financial_year.id,
    )
    create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=so4.id, financial_year_id=financial_year.id, user_id=owner.id)

    # 5. Balaji Infra Projects / Riverside Towers -- invoiced and fully paid.
    q5 = make_quotation(
        "Balaji Infra Projects",
        [{"item_id": items_by_sku["TILE-KAJ-2X2ft"].id, "qty": Decimal("300"), "uom": "BOX"}],
        project_name="Riverside Towers",
    )
    q5.status = "approved"
    db.flush()
    so5 = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=q5.id, warehouse_id=main_warehouse.id, financial_year_id=financial_year.id,
    )
    dc5 = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=so5.id, financial_year_id=financial_year.id, user_id=owner.id)
    inv5 = create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=dc5.id, financial_year_id=financial_year.id)
    record_receipt(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=main_branch.id, financial_year_id=financial_year.id,
        customer_id=customers_by_name["Balaji Infra Projects"].id, amount=inv5.total, mode="upi",
        reference_note="Full settlement", invoice_id=inv5.id,
    )

    # 6. Ganesh Traders -- invoiced, unpaid (shows up in outstanding/collections).
    q6 = make_quotation("Ganesh Traders", [{"item_id": items_by_sku["CEM-AMB-PPC"].id, "qty": Decimal("150"), "uom": "BAG"}])
    q6.status = "approved"
    db.flush()
    so6 = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=q6.id, warehouse_id=main_warehouse.id, financial_year_id=financial_year.id,
    )
    dc6 = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=so6.id, financial_year_id=financial_year.id, user_id=owner.id)
    create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=dc6.id, financial_year_id=financial_year.id)

    db.commit()
    print(f"Seeded tenant '{tenant.slug}' ({tenant.id}).")
    print("Owner login: owner@sribalaji-demo.example.com / demo-password-123")
    db.close()


if __name__ == "__main__":
    main()
