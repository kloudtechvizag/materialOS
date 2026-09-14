"""Platform-side per-tenant audit log viewer (ADR-020): audit_log has no
platform-bypass RLS clause (unlike support_tickets), so reading it
cross-tenant requires the same one-tenant-at-a-time set_session_context
pattern _tenant_summary already uses -- this proves that pattern also
works for a real read, and that it stays scoped to exactly one tenant.
"""
import uuid

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models.platform_admin import PlatformAdmin
from app.security import hash_password

client = TestClient(app)


def _make_platform_admin(email: str) -> str:
    db = SessionLocal()
    try:
        db.add(PlatformAdmin(email=email, full_name="Test Admin", hashed_password=hash_password("platform-pass-123")))
        db.commit()
    finally:
        db.close()
    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": "platform-pass-123"})
    return login_resp.json()["access_token"]


def _signup(slug: str) -> None:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )


def test_platform_admin_sees_a_tenants_own_audit_trail_and_only_that_tenants():
    slug_a = f"audit-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"audit-b-{uuid.uuid4().hex[:8]}"
    _signup(slug_a)  # signup itself writes real audit_log rows (companies/branches/users insert)
    _signup(slug_b)

    admin_token = _make_platform_admin(f"platform-audit-{uuid.uuid4().hex[:8]}@materialos.example")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    listing_a = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug_a}).json()
    tenant_a_id = listing_a["tenants"][0]["id"]
    listing_b = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug_b}).json()
    tenant_b_id = listing_b["tenants"][0]["id"]

    tables = client.get(f"/api/v1/platform/tenants/{tenant_a_id}/audit-logs/tables", headers=admin_headers)
    assert tables.status_code == 200
    assert "companies" in tables.json()

    logs_a = client.get(f"/api/v1/platform/tenants/{tenant_a_id}/audit-logs", headers=admin_headers, params={"table_name": "companies"})
    assert logs_a.status_code == 200
    assert len(logs_a.json()) >= 1
    assert all(entry["action"] == "INSERT" for entry in logs_a.json())

    # Tenant B's own row ids never leak into tenant A's audit trail.
    logs_a_all = client.get(f"/api/v1/platform/tenants/{tenant_a_id}/audit-logs", headers=admin_headers).json()
    logs_b_all = client.get(f"/api/v1/platform/tenants/{tenant_b_id}/audit-logs", headers=admin_headers).json()
    ids_a = {entry["row_id"] for entry in logs_a_all}
    ids_b = {entry["row_id"] for entry in logs_b_all}
    assert ids_a.isdisjoint(ids_b)


def test_a_tenant_token_cannot_access_the_platform_audit_endpoint():
    slug = f"audit-isolation-{uuid.uuid4().hex[:8]}"
    _signup(slug)
    tenant_token = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]
    resp = client.get(
        "/api/v1/platform/tenants/00000000-0000-0000-0000-000000000000/audit-logs",
        headers={"Authorization": f"Bearer {tenant_token}"},
    )
    assert resp.status_code == 401
