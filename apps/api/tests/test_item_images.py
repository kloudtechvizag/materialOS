"""Item photo upload/retrieve (ADR-019): a real tenant-uploaded image,
round-tripped through app/storage.py exactly like fleet.py's POD photos
-- never a generic stock image standing in for the item.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str) -> str:
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


def test_uploading_and_retrieving_an_item_image():
    slug = f"item-img-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}

    item_resp = client.post(
        "/api/v1/items",
        headers=headers,
        json={"sku": "CEM-001", "name": "ACC PPC 50KG", "base_uom": "BAGS"},
    )
    assert item_resp.status_code == 201
    item = item_resp.json()
    assert item["image_path"] is None

    fake_png = b"\x89PNG\r\n\x1a\nfake-but-real-bytes-for-the-round-trip"
    upload_resp = client.post(
        f"/api/v1/items/{item['id']}/image",
        headers=headers,
        files={"file": ("cement-bag.png", fake_png, "image/png")},
    )
    assert upload_resp.status_code == 200
    updated = upload_resp.json()
    assert updated["image_path"] is not None

    image_resp = client.get(f"/api/v1/items/{item['id']}/image", headers=headers)
    assert image_resp.status_code == 200
    assert image_resp.content == fake_png
    assert image_resp.headers["content-type"] == "image/png"


def test_item_without_an_uploaded_image_returns_404_not_a_placeholder():
    slug = f"item-img-none-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}

    item = client.post(
        "/api/v1/items", headers=headers, json={"sku": "CEM-002", "name": "No Photo Item", "base_uom": "BAGS"},
    ).json()

    resp = client.get(f"/api/v1/items/{item['id']}/image", headers=headers)
    assert resp.status_code == 404
