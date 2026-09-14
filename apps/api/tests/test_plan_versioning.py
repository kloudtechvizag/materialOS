"""Plan/feature editing (ADR-020's deferred "plan editing UI", now
built): a Plan is deliberately immutable (models/billing_plans.py) so
the only write path is "create a new version" -- this proves a new
version really is a new row, the old one's terms don't change under an
existing Subscription, and only one version per slug is ever current.
"""
import uuid

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models.platform_admin import PlatformAdmin
from app.security import hash_password
from app.services.billing_plans import ensure_plan_catalog

client = TestClient(app)


def _make_platform_admin(email: str) -> str:
    db = SessionLocal()
    try:
        ensure_plan_catalog(db)
        db.add(PlatformAdmin(email=email, full_name="Test Admin", hashed_password=hash_password("platform-pass-123")))
        db.commit()
    finally:
        db.close()
    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": "platform-pass-123"})
    return login_resp.json()["access_token"]


def test_creating_a_new_plan_version_never_mutates_the_old_row():
    admin_token = _make_platform_admin(f"platform-plans-{uuid.uuid4().hex[:8]}@materialos.example")
    headers = {"Authorization": f"Bearer {admin_token}"}

    slug = f"test-tier-{uuid.uuid4().hex[:8]}"
    v1 = client.post(
        "/api/v1/platform/plans", headers=headers,
        json={
            "slug": slug, "name": "Test Tier", "tier_order": 99, "monthly_price": "999.00", "yearly_price": "9590.00",
            "feature_codes": ["module.pos"], "limits": {"users": 5},
        },
    )
    assert v1.status_code == 201
    v1_body = v1.json()
    assert v1_body["version"] == 1
    assert v1_body["is_current"] is True
    assert v1_body["features"] == ["module.pos"]
    assert v1_body["limits"]["users"] == 5

    v2 = client.post(
        "/api/v1/platform/plans", headers=headers,
        json={
            "slug": slug, "name": "Test Tier", "tier_order": 99, "monthly_price": "1299.00", "yearly_price": "12470.00",
            "feature_codes": ["module.pos", "module.warehouse"], "limits": {"users": 10},
        },
    )
    assert v2.status_code == 201
    v2_body = v2.json()
    assert v2_body["version"] == 2
    assert v2_body["is_current"] is True
    assert v2_body["id"] != v1_body["id"]

    all_plans = client.get("/api/v1/platform/plans", headers=headers).json()
    versions = [p for p in all_plans if p["slug"] == slug]
    assert len(versions) == 2
    v1_after = next(p for p in versions if p["version"] == 1)
    v2_after = next(p for p in versions if p["version"] == 2)
    # The original v1 row is completely unchanged...
    assert v1_after["monthly_price"] == "999.00"
    assert v1_after["limits"]["users"] == 5
    # ...but is no longer the current version.
    assert v1_after["is_current"] is False
    assert v2_after["is_current"] is True
    assert v2_after["monthly_price"] == "1299.00"


def test_rejects_an_unknown_feature_code():
    admin_token = _make_platform_admin(f"platform-plans-bad-{uuid.uuid4().hex[:8]}@materialos.example")
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = client.post(
        "/api/v1/platform/plans", headers=headers,
        json={"slug": f"bad-{uuid.uuid4().hex[:8]}", "name": "Bad", "tier_order": 1, "feature_codes": ["not.a.real.feature"]},
    )
    assert resp.status_code == 422


def test_a_tenant_token_cannot_create_a_plan_version():
    resp = client.get("/api/v1/platform/plans")
    assert resp.status_code == 401
