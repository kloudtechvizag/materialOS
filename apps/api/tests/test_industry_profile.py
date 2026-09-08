"""Slice A of the Industry Profile Engine (ADR-010): the catalog is
public, a new company gets building_materials by default, an unknown
slug is rejected, and the resolved profile round-trips through the
companies endpoint.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


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
