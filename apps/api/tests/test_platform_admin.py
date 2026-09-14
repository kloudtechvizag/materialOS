"""Platform admin console (ADR-020): a real cross-tenant login, distinct
from every tenant's own auth, that can see and act on tenants it never
signed up through. Verifies both that it works AND that it can't be
confused with a regular tenant-user token.
"""
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models.platform_admin import PlatformAdmin
from app.security import hash_password

client = TestClient(app)


def _make_platform_admin(email: str) -> None:
    db = SessionLocal()
    try:
        db.add(PlatformAdmin(email=email, full_name="Test Admin", hashed_password=hash_password("platform-pass-123")))
        db.commit()
    finally:
        db.close()


def _signed_up_tenant_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_platform_admin_can_login_and_see_a_tenant_it_never_touched_before():
    email = f"platform-{uuid.uuid4().hex[:8]}@materialos.example"
    _make_platform_admin(email)

    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": "platform-pass-123"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/platform/auth/me", headers=headers).json()["email"] == email

    slug = f"platform-test-{uuid.uuid4().hex[:8]}"
    _signed_up_tenant_token(slug)

    listing = client.get("/api/v1/platform/tenants", headers=headers, params={"q": slug})
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1
    tenants = body["tenants"]
    assert len(tenants) == 1
    assert tenants[0]["slug"] == slug
    assert tenants[0]["user_count"] == 1
    assert tenants[0]["status"] == "active"

    tenant_id = tenants[0]["id"]
    detail = client.get(f"/api/v1/platform/tenants/{tenant_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["company_name"] == "X"

    suspended = client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=headers, json={"status": "suspended"})
    assert suspended.status_code == 200
    assert suspended.json()["status"] == "suspended"


def test_a_tenant_users_token_cannot_access_the_platform_console():
    slug = f"platform-isolation-{uuid.uuid4().hex[:8]}"
    tenant_token = _signed_up_tenant_token(slug)

    resp = client.get("/api/v1/platform/tenants", headers={"Authorization": f"Bearer {tenant_token}"})
    assert resp.status_code == 401


def test_a_platform_admin_token_cannot_access_tenant_endpoints():
    email = f"platform-{uuid.uuid4().hex[:8]}@materialos.example"
    _make_platform_admin(email)
    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": "platform-pass-123"})
    platform_token = login_resp.json()["access_token"]

    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {platform_token}"})
    assert resp.status_code == 401
