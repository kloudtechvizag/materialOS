"""Tenant archival (ADR-020): a soft delete, not a hard one -- a real,
verified backup is taken before anything is deactivated, and archiving
must actually cut a tenant's users off, not just relabel a status field
that nothing enforces. Also covers the login/refresh enforcement fix
that suspension needed to be a real block in the first place.
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


def _signup(slug: str) -> dict:
    resp = client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    return resp.json()


def _login(slug: str) -> dict:
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()


def test_archive_tenant_takes_a_backup_and_locks_out_every_user():
    slug = f"archive-{uuid.uuid4().hex[:8]}"
    _signup(slug)
    tokens = _login(slug)
    tenant_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]

    admin_token = _make_platform_admin(f"platform-archive-{uuid.uuid4().hex[:8]}@materialos.example")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    listing = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug}).json()
    tenant_id = listing["tenants"][0]["id"]

    # The still-valid access token works right up until archive.
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tenant_token}"}).status_code == 200

    archive = client.post(f"/api/v1/platform/tenants/{tenant_id}/archive", headers=admin_headers)
    assert archive.status_code == 200
    body = archive.json()
    assert body["tenant"]["status"] == "archived"
    assert body["backup_status"] == "completed"
    assert body["backup_id"]

    # Immediate cutoff: the same still-unexpired access token is now rejected.
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tenant_token}"}).status_code == 401

    # Login and refresh are both blocked for an archived tenant.
    assert client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token}).status_code == 401

    # Archiving twice is refused.
    assert client.post(f"/api/v1/platform/tenants/{tenant_id}/archive", headers=admin_headers).status_code == 422

    # An archived tenant can't be flipped back to active/suspended via the plain status endpoint.
    assert client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=admin_headers, json={"status": "active"}).status_code == 422


def test_suspended_tenant_cannot_login_or_refresh():
    slug = f"suspend-enforce-{uuid.uuid4().hex[:8]}"
    _signup(slug)
    tokens = _login(slug)
    refresh_token = tokens["refresh_token"]

    admin_token = _make_platform_admin(f"platform-suspend-{uuid.uuid4().hex[:8]}@materialos.example")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    listing = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug}).json()
    tenant_id = listing["tenants"][0]["id"]

    suspend = client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=admin_headers, json={"status": "suspended"})
    assert suspend.status_code == 200

    assert client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).status_code == 401
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token}).status_code == 401

    reactivate = client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=admin_headers, json={"status": "active"})
    assert reactivate.status_code == 200
    assert client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).status_code == 200
