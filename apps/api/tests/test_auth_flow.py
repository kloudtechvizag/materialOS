"""Integration test for the primary auth workflow (G4): signup a tenant,
log in, and fetch the current user -- exercising the API layer, RLS
session-context wiring, and JWT issuance together.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.main import app
from app.models.user import Permission, Role, RolePermission, User, UserRole
from app.security import create_access_token, decode_token

client = TestClient(app)


def test_signup_then_login_then_me():
    slug = f"acceptance-{uuid.uuid4().hex[:8]}"
    signup_resp = client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "Sri Balaji Building Materials",
            "tenant_slug": slug,
            "company_name": "Sri Balaji Building Materials",
            "company_legal_name": "Sri Balaji Building Materials Pvt Ltd",
            "owner_full_name": "Test Owner",
            "owner_email": f"owner-{slug}@example.com",
            "owner_password": "correct-horse-battery-staple",
        },
    )
    assert signup_resp.status_code == 201, signup_resp.text

    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": slug,
            "email": f"owner-{slug}@example.com",
            "password": "correct-horse-battery-staple",
        },
    )
    assert login_resp.status_code == 200, login_resp.text
    tokens = login_resp.json()
    assert tokens["access_token"]

    me_resp = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me_resp.status_code == 200, me_resp.text
    me = me_resp.json()
    assert me["email"] == f"owner-{slug}@example.com"
    assert "owner" in me["roles"]
    # The owner role is seeded with the full permission catalog -- real
    # per-resource codes, not a placeholder, so the frontend can filter
    # navigation by what this user actually holds.
    assert "users.view" in me["permissions"]
    assert "customers.view" in me["permissions"]


def test_me_reflects_only_the_real_permissions_a_limited_role_actually_holds():
    slug = f"limited-perm-{uuid.uuid4().hex[:8]}"
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
    owner_token = login_resp.json()["access_token"]
    payload = decode_token(owner_token)
    tenant_id = uuid.UUID(payload["tenant_id"])

    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    db = Session()
    try:
        set_session_context(db, tenant_id=str(tenant_id), user_id=None)
        role = Role(tenant_id=tenant_id, name="Customers Only")
        db.add(role)
        db.flush()
        customers_view = db.query(Permission).filter(Permission.code == "customers.view").one()
        db.add(RolePermission(tenant_id=tenant_id, role_id=role.id, permission_id=customers_view.id))
        limited_user = User(tenant_id=tenant_id, email="limited@example.com", full_name="Limited", hashed_password="x", is_active=True)
        db.add(limited_user)
        db.flush()
        db.add(UserRole(tenant_id=tenant_id, user_id=limited_user.id, role_id=role.id))
        db.commit()
        limited_user_id = limited_user.id
    finally:
        db.close()

    limited_token = create_access_token(user_id=limited_user_id, tenant_id=tenant_id)
    resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {limited_token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["permissions"] == ["customers.view"]


def test_wrong_password_returns_typed_error():
    slug = f"wrongpw-{uuid.uuid4().hex[:8]}"
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X",
            "tenant_slug": slug,
            "company_name": "X",
            "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner",
            "owner_email": f"owner-{slug}@example.com",
            "owner_password": "correct-horse-battery-staple",
        },
    )

    resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "wrong"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "UNAUTHORIZED"
    assert "retryable" in body["error"]
