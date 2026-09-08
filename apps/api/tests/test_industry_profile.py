"""Slice A of the Industry Profile Engine (ADR-010): the catalog is
public, a new company gets building_materials by default, an unknown
slug is rejected, and the resolved profile round-trips through the
companies endpoint.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services.industry import PROFILE_DEFINITIONS

client = TestClient(app)

VALID_MODULES = {
    "sales", "purchase", "inventory", "warehouse", "dispatch", "fleet", "credit",
    "collections", "projects", "field_sales", "accounting", "gst", "pos", "printing",
}
VALID_WIDGETS = {
    "outstanding", "invoiced", "open_quotations", "open_sales_orders", "active_items",
    "active_customers", "todays_sales", "todays_cash", "todays_upi", "todays_card", "near_expiry",
    "jobs_due_today", "jobs_overdue", "jobs_in_production",
}


def test_all_24_industries_from_the_brief_are_defined_with_no_typos():
    """Locks in the full catalog (building_materials/retail/pharmacy,
    the 20 more added on request, and printing_press) against
    accidental duplicate/typo'd slugs, and against referencing a module
    or dashboard widget key that
    doesn't actually exist on the frontend -- both would silently no-op
    (buildNavigation()/DASHBOARD_WIDGETS both filter unknown keys rather
    than erroring), so nothing else would catch it."""
    slugs = [p["slug"] for p in PROFILE_DEFINITIONS]
    assert len(slugs) == 24
    assert len(slugs) == len(set(slugs)), "duplicate slug in PROFILE_DEFINITIONS"

    for p in PROFILE_DEFINITIONS:
        unknown_modules = set(p["enabled_modules"]) - VALID_MODULES
        assert not unknown_modules, f"{p['slug']}: unknown module(s) {unknown_modules}"
        unknown_widgets = set(p["dashboard_widgets"]) - VALID_WIDGETS
        assert not unknown_widgets, f"{p['slug']}: unknown widget(s) {unknown_widgets}"


def test_all_industry_profiles_reachable_via_the_public_endpoint():
    resp = client.get("/api/v1/industry-profiles")
    assert resp.status_code == 200, resp.text
    slugs = {p["slug"] for p in resp.json()}
    for definition in PROFILE_DEFINITIONS:
        assert definition["slug"] in slugs, f"{definition['slug']} not returned by GET /industry-profiles"


def _signup(slug: str, **overrides) -> dict:
    payload = {
        "tenant_name": "X",
        "tenant_slug": slug,
        "company_name": "X",
        "company_legal_name": "X Pvt Ltd",
        "owner_full_name": "Owner",
        "owner_email": f"owner-{slug}@example.com",
        "owner_password": "correct-horse-battery-staple",
    }
    payload.update(overrides)
    return client.post("/api/v1/tenants/signup", json=payload)


def test_industry_profiles_list_is_public_and_includes_building_materials():
    resp = client.get("/api/v1/industry-profiles")
    assert resp.status_code == 200, resp.text
    slugs = {p["slug"] for p in resp.json()}
    assert "building_materials" in slugs


def test_signup_without_industry_slug_defaults_to_building_materials():
    slug = f"industry-default-{uuid.uuid4().hex[:8]}"
    signup_resp = _signup(slug)
    assert signup_resp.status_code == 201, signup_resp.text

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    token = login_resp.json()["access_token"]

    companies_resp = client.get("/api/v1/companies", headers={"Authorization": f"Bearer {token}"})
    assert companies_resp.status_code == 200, companies_resp.text
    companies = companies_resp.json()
    assert len(companies) == 1
    assert companies[0]["industry_profile"]["slug"] == "building_materials"


def test_signup_with_unknown_industry_slug_is_rejected():
    slug = f"industry-unknown-{uuid.uuid4().hex[:8]}"
    resp = _signup(slug, industry_slug="not_a_real_industry")
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def _signed_up_token(slug: str, industry_slug: str = "building_materials") -> str:
    _signup(slug, industry_slug=industry_slug)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_company_can_switch_industry_profile():
    slug = f"industry-switch-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    company = client.get("/api/v1/companies", headers=headers).json()[0]
    assert company["industry_profile"]["slug"] == "building_materials"

    switch_resp = client.patch(
        f"/api/v1/companies/{company['id']}/industry-profile", json={"industry_slug": "retail"}, headers=headers
    )
    assert switch_resp.status_code == 200, switch_resp.text
    assert switch_resp.json()["industry_profile"]["slug"] == "retail"

    # Sticks -- re-fetching sees the switched profile, not the original.
    refetched = client.get("/api/v1/companies", headers=headers).json()[0]
    assert refetched["industry_profile"]["slug"] == "retail"


def test_switching_to_unknown_industry_slug_is_rejected():
    slug = f"industry-switch-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    company = client.get("/api/v1/companies", headers=headers).json()[0]

    resp = client.patch(
        f"/api/v1/companies/{company['id']}/industry-profile", json={"industry_slug": "not_a_real_industry"}, headers=headers
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
