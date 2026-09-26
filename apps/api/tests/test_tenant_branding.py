"""Tenant brand logo upload, retrieval, and removal tests.
Verifies the multi-profile brand identity workflow across tenant settings,
companies, and public/authorized asset delivery.
"""
import uuid
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "Test Organization",
            "tenant_slug": slug,
            "company_name": "Test Company",
            "company_legal_name": "Test Company Pvt Ltd",
            "owner_full_name": "Owner User",
            "owner_email": f"owner-{slug}@example.com",
            "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={
            "tenant_slug": slug,
            "email": f"owner-{slug}@example.com",
            "password": "correct-horse-battery-staple",
        },
    )
    return login_resp.json()["access_token"]


def test_tenant_branding_logo_lifecycle():
    slug = f"brand-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Initial settings check - logo_url should be None
    settings_resp = client.get("/api/v1/tenant/settings", headers=headers)
    assert settings_resp.status_code == 200
    settings_data = settings_resp.json()
    assert settings_data["slug"] == slug
    assert settings_data["logo_url"] is None
    assert settings_data["company_name"] == "Test Company"

    # 2. Rejection of invalid file extension
    bad_file = b"just some text"
    bad_ext_resp = client.post(
        "/api/v1/tenant/branding/logo",
        headers=headers,
        files={"file": ("logo.txt", bad_file, "text/plain")},
    )
    assert bad_ext_resp.status_code == 422

    # 3. Rejection of oversized file (> 2 MB)
    large_file = b"x" * (2 * 1024 * 1024 + 10)
    oversized_resp = client.post(
        "/api/v1/tenant/branding/logo",
        headers=headers,
        files={"file": ("large_logo.png", large_file, "image/png")},
    )
    assert oversized_resp.status_code == 422

    # 4. Valid logo upload (PNG)
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    upload_resp = client.post(
        "/api/v1/tenant/branding/logo",
        headers=headers,
        files={"file": ("company-logo.png", valid_png, "image/png")},
    )
    assert upload_resp.status_code == 200
    upload_data = upload_resp.json()
    assert upload_data["logo_url"] == "/api/v1/tenant/branding/logo"
    assert upload_data["file_name"] == "company-logo.png"

    # 5. Retrieve logo via GET with Bearer token
    get_resp = client.get("/api/v1/tenant/branding/logo", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.content == valid_png
    assert get_resp.headers["content-type"] == "image/png"

    # 6. Retrieve logo via GET with ?token= param (e.g. for print preview / thermal popups)
    get_token_resp = client.get(f"/api/v1/tenant/branding/logo?token={token}")
    assert get_token_resp.status_code == 200
    assert get_token_resp.content == valid_png

    # 7. Check tenant settings now includes logo_url
    updated_settings = client.get("/api/v1/tenant/settings", headers=headers).json()
    assert updated_settings["logo_url"] == "/api/v1/tenant/branding/logo"

    # 8. Check companies API also includes logo_url
    companies_resp = client.get("/api/v1/companies", headers=headers)
    assert companies_resp.status_code == 200
    companies = companies_resp.json()
    assert len(companies) > 0
    assert companies[0]["logo_url"] == "/api/v1/tenant/branding/logo"

    # 9. Delete brand logo
    delete_resp = client.delete("/api/v1/tenant/branding/logo", headers=headers)
    assert delete_resp.status_code == 200
    delete_data = delete_resp.json()
    assert delete_data["success"] is True
    assert delete_data["logo_url"] is None

    # 10. Check settings after deletion
    cleared_settings = client.get("/api/v1/tenant/settings", headers=headers).json()
    assert cleared_settings["logo_url"] is None

    # 11. GET logo after deletion returns 404
    get_deleted_resp = client.get("/api/v1/tenant/branding/logo", headers=headers)
    assert get_deleted_resp.status_code == 404
