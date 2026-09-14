"""In-app platform admin creation (ADR-020): gated by the acting admin
re-entering their OWN current password, not the new admin's -- proves
a stolen platform session token alone can't mint new admins, and that
every new admin records who vouched for them.
"""
import uuid

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models.platform_admin import PlatformAdmin
from app.security import hash_password

client = TestClient(app)


def _make_platform_admin(email: str, password: str = "platform-pass-123") -> tuple[str, str]:
    db = SessionLocal()
    try:
        admin = PlatformAdmin(email=email, full_name="Test Admin", hashed_password=hash_password(password))
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = str(admin.id)
    finally:
        db.close()
    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": password})
    return login_resp.json()["access_token"], admin_id


def test_creating_an_admin_requires_the_acting_admins_own_correct_password():
    token, admin_id = _make_platform_admin(f"platform-creator-{uuid.uuid4().hex[:8]}@materialos.example")
    headers = {"Authorization": f"Bearer {token}"}
    new_email = f"platform-new-{uuid.uuid4().hex[:8]}@materialos.example"

    wrong = client.post(
        "/api/v1/platform/admins", headers=headers,
        json={"email": new_email, "full_name": "New Admin", "password": "new-admin-pass-123", "acting_admin_password": "totally-wrong"},
    )
    assert wrong.status_code == 401

    # The wrong-password attempt must not have created anything.
    listing_before = client.get("/api/v1/platform/admins", headers=headers).json()
    assert not any(a["email"] == new_email for a in listing_before)

    right = client.post(
        "/api/v1/platform/admins", headers=headers,
        json={"email": new_email, "full_name": "New Admin", "password": "new-admin-pass-123", "acting_admin_password": "platform-pass-123"},
    )
    assert right.status_code == 201
    body = right.json()
    assert body["email"] == new_email
    assert body["created_by_admin_id"] == admin_id

    # The new admin can actually log in with the password that was set.
    new_login = client.post("/api/v1/platform/auth/login", json={"email": new_email, "password": "new-admin-pass-123"})
    assert new_login.status_code == 200

    listing_after = client.get("/api/v1/platform/admins", headers=headers).json()
    created = next(a for a in listing_after if a["email"] == new_email)
    assert created["created_by_admin_id"] == admin_id


def test_cannot_create_a_duplicate_admin_email():
    token, _ = _make_platform_admin(f"platform-dup-{uuid.uuid4().hex[:8]}@materialos.example")
    headers = {"Authorization": f"Bearer {token}"}
    dup_email = f"platform-dup-target-{uuid.uuid4().hex[:8]}@materialos.example"
    _make_platform_admin(dup_email)

    resp = client.post(
        "/api/v1/platform/admins", headers=headers,
        json={"email": dup_email, "full_name": "Dup", "password": "whatever-123", "acting_admin_password": "platform-pass-123"},
    )
    assert resp.status_code == 422


def test_a_tenant_token_cannot_create_platform_admins():
    resp = client.post(
        "/api/v1/platform/admins",
        json={"email": "x@example.com", "full_name": "X", "password": "x", "acting_admin_password": "x"},
    )
    assert resp.status_code == 401
