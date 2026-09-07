"""Integration test for the primary auth workflow (G4): signup a tenant,
log in, and fetch the current user -- exercising the API layer, RLS
session-context wiring, and JWT issuance together.
"""

import uuid

from fastapi.testclient import TestClient

from app.main import app

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
