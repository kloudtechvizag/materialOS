#!/usr/bin/env python3
"""Civil & Building Contractors ERP demo tenant -- Apex Civil Contractors.

Industry Profile: `construction_contractor` (Building Contractors & Civil Construction).
Demonstrates project-based execution: commercial BOQ containers, multi-site destinations,
work items (concrete, TMT rebar, shuttering, earthwork), client billing, and subcontractor operations.

Owner credentials:
    Tenant Slug: contractor-demo
    Email: owner@contractor-demo.example.com
    Password: demo-password-123
"""

import sys
import uuid
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.db import SessionLocal, set_session_context  # noqa: E402
from app.models.catalog import Category  # noqa: E402
from app.models.masters import Customer, Item, Supplier  # noqa: E402
from app.models.projects import Project, Site  # noqa: E402
from app.models.tenant import Tenant, Company, Branch, Warehouse  # noqa: E402
from app.models.user import User  # noqa: E402
from app.schemas.tenant import TenantSignupRequest  # noqa: E402
from app.services.industry import ensure_industry_profile_catalog  # noqa: E402
from app.services.inventory import apply_ledger_movement  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402
from app.services.tenant_signup import signup_tenant  # noqa: E402

TENANT_SLUG = "contractor-demo"
OWNER_EMAIL = "owner@contractor-demo.example.com"
OWNER_PASSWORD = "demo-password-123"

BOQ_ITEMS = [
    ("BOQ-CONC-M25", "M25 Grade Ready Mix Reinforced Concrete", "CUM", Decimal("4850.00"), Decimal("4200.00"), 120),
    ("BOQ-STEEL-550D", "Fe-550D High Yield Structural TMT Rebar", "MT", Decimal("64500.00"), Decimal("58000.00"), 45),
    ("BOQ-FORMWORK-PLY", "Film-Faced Shuttering Formwork & Props", "SQM", Decimal("380.00"), Decimal("290.00"), 500),
    ("BOQ-EARTH-EXC", "Mechanical Earthwork & Bulk Foundation Excavation", "CUM", Decimal("220.00"), Decimal("160.00"), 850),
    ("BOQ-BRICK-AAC", "Lightweight Autoclaved Aerated Concrete (AAC) Blocks", "CUM", Decimal("3200.00"), Decimal("2650.00"), 80),
]


def main() -> None:
    db = SessionLocal()
    ensure_permission_catalog(db)
    ensure_industry_profile_catalog(db)
    db.commit()

    existing = db.query(Tenant).filter_by(slug=TENANT_SLUG).first()
    if not existing:
        result = signup_tenant(
            db,
            TenantSignupRequest(
                tenant_name="Apex Civil & Building Contractors",
                tenant_slug=TENANT_SLUG,
                company_name="Apex Civil & Building Contractors",
                company_legal_name="Apex Infrastructure & Civil Contractors Pvt Ltd",
                company_state="Andhra Pradesh",
                owner_full_name="Rajesh Varma (Project Director)",
                owner_email=OWNER_EMAIL,
                owner_password=OWNER_PASSWORD,
                industry_slug="construction_contractor",
            ),
        )
        tenant_id, company_id, warehouse_id = result["tenant_id"], result["company_id"], result["warehouse_id"]
    else:
        tenant_id = existing.id
        set_session_context(db, tenant_id=str(tenant_id), user_id=None)
        company = db.query(Company).filter_by(tenant_id=tenant_id).first()
        company_id = company.id
        warehouse = db.query(Warehouse).filter_by(tenant_id=tenant_id).first()
        warehouse_id = warehouse.id

    owner = db.query(User).filter_by(tenant_id=tenant_id).first()

    # 1. Create Civil Clients / Employers if not present
    client1 = db.query(Customer).filter_by(tenant_id=tenant_id, name="National Highways & Infrastructure Authority").first()
    if not client1:
        client1 = Customer(
            tenant_id=tenant_id,
            company_id=company_id,
            name="National Highways & Infrastructure Authority",
            gstin="37AAACN0123D1ZM",
            billing_state="Andhra Pradesh",
            credit_limit=Decimal("50000000.00"),
            credit_days=45,
            is_active=True,
        )
        db.add(client1)
        db.flush()

    client2 = db.query(Customer).filter_by(tenant_id=tenant_id, name="Prestige Urban Infra Developers").first()
    if not client2:
        client2 = Customer(
            tenant_id=tenant_id,
            company_id=company_id,
            name="Prestige Urban Infra Developers",
            gstin="37AABCP9876E1ZN",
            billing_state="Andhra Pradesh",
            credit_limit=Decimal("25000000.00"),
            credit_days=30,
            is_active=True,
        )
        db.add(client2)
        db.flush()

    # 2. Create Active Construction Projects and Delivery Sites
    proj1 = db.query(Project).filter_by(tenant_id=tenant_id, name="NH-16 Elevated Corridor Package-4").first()
    if not proj1:
        proj1 = Project(
            tenant_id=tenant_id,
            customer_id=client1.id,
            name="NH-16 Elevated Corridor Package-4",
            project_manager="Er. S. R. Murthy",
            contractor="Apex Civil & Building Contractors",
            architect="L&T Infrastructure Design",
            expected_completion=date.today() + timedelta(days=240),
            status="active",
        )
        db.add(proj1)
        db.flush()

    proj2 = db.query(Project).filter_by(tenant_id=tenant_id, name="Prestige High-Rise Commercial Hub (Tower A & B)").first()
    if not proj2:
        proj2 = Project(
            tenant_id=tenant_id,
            customer_id=client2.id,
            name="Prestige High-Rise Commercial Hub (Tower A & B)",
            project_manager="Er. Anand Kulkarni",
            contractor="Apex Civil & Building Contractors",
            architect="Hafeez Contractor Architects",
            expected_completion=date.today() + timedelta(days=365),
            status="active",
        )
        db.add(proj2)
        db.flush()

    site1 = db.query(Site).filter_by(tenant_id=tenant_id, project_id=proj1.id).first()
    if not site1:
        site1 = Site(
            tenant_id=tenant_id,
            project_id=proj1.id,
            name="NH-16 Pier Casting Yard & Pier 40-75",
            address_line1="Chainage 18+400, Anandapuram Junction",
            city="Visakhapatnam",
            state="Andhra Pradesh",
            pincode="530052",
            gstin="37AAACN0123D1ZM",
        )
        db.add(site1)

    site2 = db.query(Site).filter_by(tenant_id=tenant_id, project_id=proj2.id).first()
    if not site2:
        site2 = Site(
            tenant_id=tenant_id,
            project_id=proj2.id,
            name="Prestige Tower Site Office & Central Store",
            address_line1="Sector 7, Amaravati Ring Road",
            city="Vijayawada",
            state="Andhra Pradesh",
            pincode="520008",
            gstin="37AABCP9876E1ZN",
        )
        db.add(site2)
    db.flush()

    # 3. Create Material Suppliers & Subcontractors
    supplier1 = db.query(Supplier).filter_by(tenant_id=tenant_id, name="Sri Balaji RMC & Aggregates").first()
    if not supplier1:
        supplier1 = Supplier(
            tenant_id=tenant_id,
            company_id=company_id,
            name="Sri Balaji RMC & Aggregates",
            gstin="37AASCS1234F1Z5",
            billing_state="Andhra Pradesh",
            category="RMC & Aggregates",
            is_active=True,
        )
        db.add(supplier1)

    supplier2 = db.query(Supplier).filter_by(tenant_id=tenant_id, name="Vizag Steel Rebar Depot").first()
    if not supplier2:
        supplier2 = Supplier(
            tenant_id=tenant_id,
            company_id=company_id,
            name="Vizag Steel Rebar Depot",
            gstin="37AAACR1234K1ZL",
            billing_state="Andhra Pradesh",
            category="Steel Reinforcement",
            is_active=True,
        )
        db.add(supplier2)
    db.flush()

    # 4. Populate BOQ Work Items & Materials
    category = db.query(Category).filter_by(tenant_id=tenant_id, name="Civil BOQ Items & Structural Materials").first()
    if not category:
        category = Category(
            tenant_id=tenant_id,
            company_id=company_id,
            name="Civil BOQ Items & Structural Materials",
        )
        db.add(category)
        db.flush()

    for sku, name, uom, price, cost, opening_qty in BOQ_ITEMS:
        item = db.query(Item).filter_by(tenant_id=tenant_id, sku=sku).first()
        if not item:
            item = Item(
                tenant_id=tenant_id,
                company_id=company_id,
                sku=sku,
                name=name,
                base_uom=uom,
                category_id=category.id,
                standard_price=price,
                min_price=cost,
                standard_cost=cost,
                hsn_code="9954" if "BOQ" in sku else "7214",
                gst_rate=Decimal("18.00"),
                is_active=True,
            )
            db.add(item)
            db.flush()

            # Seed site store opening inventory
            apply_ledger_movement(
                db,
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
                item_id=item.id,
                qty=Decimal(str(opening_qty)),
                rate=cost,
                movement_type="opening",
                reference_type="seed_script",
                reference_id=uuid.uuid4(),
                user_id=owner.id if owner else None,
            )

    db.commit()
    print("Successfully seeded Construction / Contractors ERP demo tenant:")
    print(f"  Tenant Name: Apex Civil & Building Contractors")
    print(f"  Tenant Slug: {TENANT_SLUG}")
    print(f"  Owner Login: {OWNER_EMAIL} / {OWNER_PASSWORD}")
    print(f"  Industry Profile: construction_contractor (Civil & Building Contractors)")


if __name__ == "__main__":
    main()
