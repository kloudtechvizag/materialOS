"""Jewellery's pricing_strategy ("weight_making_wastage", services/
industry.py) was declared but never implemented -- resolve_price()
ignored it, so a jewellery tenant priced every item off a static
standard_price exactly like a hardware store. This proves the real
formula (metal value + making charge + wastage + stone charge, using a
tenant-entered day rate -- no live gold-rate feed exists or should be
fabricated) actually drives pricing end-to-end through a real
quotation, and that it never overrides a negotiated rate contract or
customer price.
"""
import uuid
from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.models.industry import IndustryProfile
from app.models.jewellery import MetalRate
from app.models.masters import Customer, Item
from app.services.industry import ensure_industry_profile_catalog
from app.services.pricing import compute_jewellery_price, resolve_price

client = TestClient(app)


def _jewellery_company(db, tenant_ctx):
    ensure_industry_profile_catalog(db)
    db.flush()
    profile = db.query(IndustryProfile).filter_by(slug="jewellery").one()
    company = tenant_ctx["company"]
    company.industry_profile_id = profile.id
    db.flush()
    return company


def _gold_item(db, tenant_ctx, **attr_overrides):
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]
    attrs = {
        "metal": "gold", "purity": "22K", "net_weight_g": 10, "making_charge_type": "percentage",
        "making_charge_value": 12, "wastage_percentage": 4, "stone_charge": 200,
    }
    attrs.update(attr_overrides)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"GOLD-{uuid.uuid4().hex[:6]}", name="22K Gold Chain",
        gst_rate=Decimal("3"), base_uom="PCS", standard_price=Decimal("1000"), standard_cost=Decimal("900"),
        attributes=attrs,
    )
    db.add(item)
    db.flush()
    return item


def test_compute_jewellery_price_matches_the_real_formula(db, tenant_ctx):
    company = _jewellery_company(db, tenant_ctx)
    item = _gold_item(db, tenant_ctx)
    db.add(MetalRate(tenant_id=tenant_ctx["tenant"].id, company_id=company.id, metal="gold", purity="22K", rate_per_gram=Decimal("6000"), effective_date=date.today()))
    db.flush()

    price = compute_jewellery_price(db, item=item, company_id=company.id, as_of=date.today())

    metal_value = Decimal("10") * Decimal("6000")  # 60000
    making = metal_value * Decimal("12") / 100  # 7200
    wastage = metal_value * Decimal("4") / 100  # 2400
    expected = metal_value + making + wastage + Decimal("200")  # 69800
    assert price == expected == Decimal("69800")


def test_resolve_price_uses_jewellery_formula_for_a_jewellery_company(db, tenant_ctx):
    tenant, company = tenant_ctx["tenant"], _jewellery_company(db, tenant_ctx)
    item = _gold_item(db, tenant_ctx)
    db.add(MetalRate(tenant_id=tenant.id, company_id=company.id, metal="gold", purity="22K", rate_per_gram=Decimal("6000"), effective_date=date.today()))
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Wedding Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()

    result = resolve_price(db, customer_id=customer.id, item=item, qty=Decimal("1"), project_id=None, as_of=date.today(), company=company)
    assert result.source == "weight_making_wastage"
    assert result.unit_price == Decimal("69800")


def test_resolve_price_falls_back_to_standard_price_without_weight_data(db, tenant_ctx):
    tenant, company = tenant_ctx["tenant"], _jewellery_company(db, tenant_ctx)
    item = _gold_item(db, tenant_ctx, metal=None, net_weight_g=None)  # a non-weight-priced jewellery item, e.g. a gift box
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Gift Box Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()

    result = resolve_price(db, customer_id=customer.id, item=item, qty=Decimal("1"), project_id=None, as_of=date.today(), company=company)
    assert result.source == "standard_price"
    assert result.unit_price == item.standard_price


def test_resolve_price_falls_back_to_standard_price_without_a_metal_rate_entered(db, tenant_ctx):
    tenant, company = tenant_ctx["tenant"], _jewellery_company(db, tenant_ctx)
    item = _gold_item(db, tenant_ctx)  # no MetalRate row added at all
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="No Rate Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()

    result = resolve_price(db, customer_id=customer.id, item=item, qty=Decimal("1"), project_id=None, as_of=date.today(), company=company)
    assert result.source == "standard_price"


def test_a_customer_price_still_overrides_the_jewellery_formula(db, tenant_ctx):
    from app.models.pricing import CustomerItemPrice

    tenant, company = tenant_ctx["tenant"], _jewellery_company(db, tenant_ctx)
    item = _gold_item(db, tenant_ctx)
    db.add(MetalRate(tenant_id=tenant.id, company_id=company.id, metal="gold", purity="22K", rate_per_gram=Decimal("6000"), effective_date=date.today()))
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Negotiated Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()
    db.add(CustomerItemPrice(tenant_id=tenant.id, customer_id=customer.id, item_id=item.id, price=Decimal("65000")))
    db.flush()

    result = resolve_price(db, customer_id=customer.id, item=item, qty=Decimal("1"), project_id=None, as_of=date.today(), company=company)
    assert result.source == "customer_price"
    assert result.unit_price == Decimal("65000")


def test_other_industry_profiles_are_completely_unaffected(db, tenant_ctx):
    """building_materials (the default profile) must keep resolving to
    standard_price even for an item that happens to carry jewellery-
    shaped attributes -- the formula only activates for pricing_strategy
    == weight_making_wastage, never generically off item.attributes."""
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]
    assert company.industry_profile_id is None or company.industry_profile_id != "jewellery"
    item = _gold_item(db, tenant_ctx)
    db.add(MetalRate(tenant_id=tenant.id, company_id=company.id, metal="gold", purity="22K", rate_per_gram=Decimal("6000"), effective_date=date.today()))
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Non Jewellery Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()

    result = resolve_price(db, customer_id=customer.id, item=item, qty=Decimal("1"), project_id=None, as_of=date.today(), company=company)
    assert result.source == "standard_price"


def _signed_up_token(slug: str) -> str:
    # industry_slug="jewellery" is required now that /metal-rates is
    # gated by require_module("jewellery") (ADR-022's pattern extended
    # to jewellery) -- a non-jewellery tenant genuinely can't call it.
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": "jewellery",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def test_metal_rate_api_upserts_by_day_and_lists_newest_first():
    slug = f"jewel-api-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/metal-rates", headers=headers,
        json={"metal": "gold", "purity": "22K", "rate_per_gram": "6000.00", "effective_date": str(date.today())},
    )
    assert create.status_code == 201
    rate_id = create.json()["id"]

    # Same metal+purity+day again -- corrects in place, doesn't duplicate.
    correction = client.post(
        "/api/v1/metal-rates", headers=headers,
        json={"metal": "gold", "purity": "22K", "rate_per_gram": "6050.00", "effective_date": str(date.today())},
    )
    assert correction.status_code == 201
    assert correction.json()["id"] == rate_id
    assert Decimal(correction.json()["rate_per_gram"]) == Decimal("6050.00")

    listing = client.get("/api/v1/metal-rates", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert Decimal(listing.json()[0]["rate_per_gram"]) == Decimal("6050.00")


def test_signing_up_as_jewellery_seeds_a_category_shaped_for_the_pricing_formula():
    """Without this, a jewellery tenant would have no real way to enter
    metal/purity/weight on an item -- the generic DynamicAttributesFieldset
    (ItemsPage.tsx) only renders fields for a category's own
    parameter_schema, and there's no UI to author one from scratch."""
    slug = f"jewel-signup-{uuid.uuid4().hex[:8]}"
    resp = client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": "jewellery",
        },
    )
    assert resp.status_code == 201, resp.text
    token = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]

    categories = client.get("/api/v1/categories", headers={"Authorization": f"Bearer {token}"}).json()
    jewellery_category = next((c for c in categories if c["name"] == "Jewellery Items"), None)
    assert jewellery_category is not None
    schema_fields = {f["name"] for f in jewellery_category["parameter_schema"]}
    assert schema_fields == {"metal", "purity", "net_weight_g", "making_charge_type", "making_charge_value", "wastage_percentage", "stone_charge"}


def test_quotation_line_for_a_jewellery_tenant_uses_the_real_formula(db, tenant_ctx):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], _jewellery_company(db, tenant_ctx), tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    item = _gold_item(db, tenant_ctx)
    db.add(MetalRate(tenant_id=tenant.id, company_id=company.id, metal="gold", purity="22K", rate_per_gram=Decimal("6000"), effective_date=date.today()))
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Quotation Test Customer", billing_state="Andhra Pradesh")
    db.add(customer)
    db.flush()

    from app.services.quotation import create_quotation

    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": Decimal("1"), "uom": "PCS"}],
    )
    db.flush()
    line = quotation.items[0]
    assert line.rate == Decimal("69800")
    assert line.line_subtotal == Decimal("69800")
