"""Impersonation (ADR-020): a platform admin can get a real, working
access token for one tenant user for support purposes, but every grant
is logged (ImpersonationSession) and the token is both short-lived and
self-identifying -- /auth/me exposes impersonated_by_admin_id so the
tenant-facing UI can show a banner, and the same claim never appears on
a normal login token.
"""
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db import SessionLocal
from app.main import app
from app.models.impersonation import ImpersonationSession
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


def _signup(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    return client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    ).json()["access_token"]


def test_platform_admin_can_impersonate_a_tenant_user_and_it_is_logged():
    slug = f"impersonate-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_token}"}).json()["id"]

    admin_token = _make_platform_admin(f"platform-imp-{uuid.uuid4().hex[:8]}@materialos.example")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    tenant_id = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug}).json()["tenants"][0]["id"]

    users = client.get(f"/api/v1/platform/tenants/{tenant_id}/users", headers=admin_headers)
    assert users.status_code == 200
    assert any(u["id"] == owner_id for u in users.json())

    impersonate = client.post(f"/api/v1/platform/tenants/{tenant_id}/users/{owner_id}/impersonate", headers=admin_headers)
    assert impersonate.status_code == 200
    body = impersonate.json()
    assert body["tenant_slug"] == slug
    imp_token = body["access_token"]

    # The impersonation token is a real, working tenant access token...
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {imp_token}"})
    assert me.status_code == 200
    assert me.json()["id"] == owner_id
    # ...that self-identifies as impersonated, unlike the owner's own token.
    assert me.json()["impersonated_by_admin_id"] is not None
    own_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_token}"})
    assert own_me.json()["impersonated_by_admin_id"] is None

    # And it left a real, queryable audit record.
    db = SessionLocal()
    try:
        sessions = db.execute(select(ImpersonationSession).where(ImpersonationSession.impersonated_user_id == uuid.UUID(owner_id))).scalars().all()
        assert len(sessions) == 1
    finally:
        db.close()


def test_cannot_impersonate_into_a_suspended_tenant_or_an_inactive_user():
    slug = f"impersonate-blocked-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    owner_id = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {owner_token}"}).json()["id"]

    admin_token = _make_platform_admin(f"platform-imp-blocked-{uuid.uuid4().hex[:8]}@materialos.example")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    tenant_id = client.get("/api/v1/platform/tenants", headers=admin_headers, params={"q": slug}).json()["tenants"][0]["id"]

    client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=admin_headers, json={"status": "suspended"})
    resp = client.post(f"/api/v1/platform/tenants/{tenant_id}/users/{owner_id}/impersonate", headers=admin_headers)
    assert resp.status_code == 422

    client.patch(f"/api/v1/platform/tenants/{tenant_id}", headers=admin_headers, json={"status": "active"})
    resp2 = client.post(f"/api/v1/platform/tenants/{tenant_id}/users/{uuid.uuid4()}/impersonate", headers=admin_headers)
    assert resp2.status_code == 404


def test_a_tenant_token_cannot_call_the_impersonation_endpoint():
    slug = f"impersonate-isolation-{uuid.uuid4().hex[:8]}"
    owner_token = _signup(slug)
    resp = client.post(
        f"/api/v1/platform/tenants/{uuid.uuid4()}/users/{uuid.uuid4()}/impersonate",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert resp.status_code == 401
