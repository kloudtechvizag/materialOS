#!/usr/bin/env python3
"""Pharmacy profile demo tenant (ADR-010) -- ABC Medicals.

Small and honest, same spirit as seed_retail.py: a Medicines category
with a real parameter_schema (proving Item.attributes/DynamicAttributes
Fieldset generalizes beyond Building Materials), a few medicines with
those attributes filled in, opening stock, and batches -- one expiring
soon (shows up in the near_expiry dashboard widget), one far out
(doesn't) -- so the Pharmacy profile visibly differs on first login.

Run from apps/api with the venv active:
    DATABASE_URL=... python ../../scripts/seed_pharmacy.py
"""

import sys
import uuid
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.db import SessionLocal, set_session_context  # noqa: E402
from app.models.catalog import Batch, Category  # noqa: E402
from app.models.masters import Item  # noqa: E402
from app.schemas.tenant import TenantSignupRequest  # noqa: E402
from app.services.industry import ensure_industry_profile_catalog  # noqa: E402
from app.services.inventory import apply_ledger_movement  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402
from app.services.tenant_signup import signup_tenant  # noqa: E402

MEDICINES = [
    ("PARA-500", "Paracetamol 500mg", "Paracetamol", "500", "OTC", Decimal("25"), Decimal("15"), 20),
    ("AMOX-250", "Amoxicillin 250mg", "Amoxicillin", "250", "Rx", Decimal("85"), Decimal("55"), 45),
    ("CETIRIZINE-10", "Cetirizine 10mg", "Cetirizine", "10", "OTC", Decimal("18"), Decimal("10"), 400),
]


def main() -> None:
    db = SessionLocal()
    ensure_permission_catalog(db)
    ensure_industry_profile_catalog(db)
    db.commit()

    result = signup_tenant(
        db,
        TenantSignupRequest(
            tenant_name="ABC Medicals",
            tenant_slug="abcmedicals-demo",
            company_name="ABC Medicals",
            company_legal_name="ABC Medicals Pvt Ltd",
            company_state="Andhra Pradesh",
            owner_full_name="Demo Owner",
            owner_email="owner@abcmedicals-demo.example.com",
            owner_password="demo-password-123",
            industry_slug="pharmacy",
        ),
    )
    tenant_id, company_id, warehouse_id = result["tenant_id"], result["company_id"], result["warehouse_id"]
    set_session_context(db, tenant_id=str(tenant_id), user_id=None)

    category = Category(
        tenant_id=tenant_id, company_id=company_id, name="Medicines",
        parameter_schema=[
            {"name": "Composition", "unit": None},
            {"name": "Strength", "unit": "mg"},
            {"name": "Schedule", "unit": None},
        ],
    )
    db.add(category)
    db.flush()

    today = date.today()
    for sku, name, composition, strength, schedule, price, cost, expiry_in_days in MEDICINES:
        item = Item(
            tenant_id=tenant_id, company_id=company_id, sku=sku, name=name,
            gst_rate=Decimal("12"), base_uom="STRIP", standard_price=price, standard_cost=cost,
            category_id=category.id,
            attributes={"Composition": composition, "Strength": strength, "Schedule": schedule},
        )
        db.add(item)
        db.flush()
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=item.id,
            qty=Decimal("200"), rate=cost, movement_type="opening",
            reference_type="seed", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
        )
        db.add(
            Batch(
                tenant_id=tenant_id, item_id=item.id, warehouse_id=warehouse_id,
                batch_code=f"B-{sku}-{expiry_in_days}D", expiry_date=today + timedelta(days=expiry_in_days), cost=cost,
            )
        )

    db.commit()
    print("Pharmacy demo tenant ready: workspace 'abcmedicals-demo', login owner@abcmedicals-demo.example.com / demo-password-123")


if __name__ == "__main__":
    main()
