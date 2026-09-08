#!/usr/bin/env python3
"""Retail profile demo tenant (ADR-010) -- Fashion Hub.

Deliberately small: this proves the Industry Profile Engine renders a
genuinely different sidebar/dashboard/POS for Retail, not another full
18-months-of-history seed like scripts/seed.py's Building Materials
tenant. A handful of items, opening stock, and two real POS sales
(through the real create_walk_in_sale service, same as the frontend
calls) so the dashboard isn't empty on first login.

Run from apps/api with the venv active:
    DATABASE_URL=... python ../../scripts/seed_retail.py
"""

import sys
import uuid
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.db import SessionLocal, set_session_context  # noqa: E402
from app.models.masters import Item  # noqa: E402
from app.schemas.tenant import TenantSignupRequest  # noqa: E402
from app.services.industry import ensure_industry_profile_catalog  # noqa: E402
from app.services.inventory import apply_ledger_movement  # noqa: E402
from app.services.money import round_invoice_total  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402
from app.services.pos import WalkInSaleLine, create_walk_in_sale  # noqa: E402
from app.services.tenant_signup import signup_tenant  # noqa: E402

RETAIL_ITEMS = [
    ("TSHIRT-BLK-M", "Black T-Shirt (M)", "PCS", Decimal("499"), Decimal("250"), Decimal("12")),
    ("TSHIRT-WHT-L", "White T-Shirt (L)", "PCS", Decimal("549"), Decimal("275"), Decimal("12")),
    ("JEANS-BLU-32", "Blue Jeans (32)", "PCS", Decimal("1499"), Decimal("800"), Decimal("12")),
    ("SNEAKER-WHT-9", "White Sneakers (9)", "PCS", Decimal("2499"), Decimal("1400"), Decimal("18")),
]


def main() -> None:
    db = SessionLocal()
    ensure_permission_catalog(db)
    ensure_industry_profile_catalog(db)
    db.commit()

    result = signup_tenant(
        db,
        TenantSignupRequest(
            tenant_name="Fashion Hub",
            tenant_slug="fashionhub-demo",
            company_name="Fashion Hub",
            company_legal_name="Fashion Hub Retail Pvt Ltd",
            company_state="Andhra Pradesh",
            owner_full_name="Demo Owner",
            owner_email="owner@fashionhub-demo.example.com",
            owner_password="demo-password-123",
            industry_slug="retail",
        ),
    )
    tenant_id, company_id, warehouse_id = result["tenant_id"], result["company_id"], result["warehouse_id"]
    set_session_context(db, tenant_id=str(tenant_id), user_id=None)

    items = []
    for sku, name, uom, price, cost, gst_rate in RETAIL_ITEMS:
        item = Item(
            tenant_id=tenant_id, company_id=company_id, sku=sku, name=name,
            gst_rate=gst_rate, base_uom=uom, standard_price=price, standard_cost=cost,
        )
        db.add(item)
        db.flush()
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=item.id,
            qty=Decimal("50"), rate=cost, movement_type="opening",
            reference_type="seed", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
        )
        items.append(item)

    # No intermediate commit here: set_session_context uses SET LOCAL,
    # scoped to the current transaction (see app/db.py) -- a commit would
    # clear the tenant context before the financial-year lookup below
    # re-establishes it, and RLS would silently return zero rows.
    fy_id = _current_fy_id(db, company_id)

    # Two real counter sales -- price_line()'s resolution for a walk-in
    # customer is always item.standard_price (no rate contract/customer
    # price exists for it), so this arithmetic matches what
    # create_walk_in_sale computes server-side exactly.
    for line_item, qty in [(items[0], Decimal("2")), (items[2], Decimal("1"))]:
        subtotal = line_item.standard_price * qty
        tax = (subtotal * line_item.gst_rate / 100).quantize(Decimal("0.0001"))
        total, _ = round_invoice_total(subtotal + tax)
        create_walk_in_sale(
            db, tenant_id=tenant_id, company_id=company_id, branch_id=result["branch_id"],
            warehouse_id=warehouse_id, financial_year_id=fy_id,
            user_id=result["user_id"], customer_id=None,
            lines=[WalkInSaleLine(item_id=line_item.id, qty=qty, uom=line_item.base_uom)],
            cash_amount=total, upi_amount=Decimal("0"), card_amount=Decimal("0"), tendered_amount=total,
        )
    db.commit()
    print(f"Retail demo tenant ready: workspace 'fashionhub-demo', login owner@fashionhub-demo.example.com / demo-password-123")


def _current_fy_id(db, company_id):
    from app.services.numbering import get_current_financial_year

    return get_current_financial_year(db, company_id).id


if __name__ == "__main__":
    main()
