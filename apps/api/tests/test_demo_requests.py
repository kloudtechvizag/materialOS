"""Public marketing site's "Book a demo" capture -- genuinely
unauthenticated (no Authorization header), platform-level (no
tenant_id, no RLS -- see models/demo_request.py)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_demo_request_creates_a_real_row_with_no_auth_header():
    resp = client.post(
        "/api/v1/public/demo-requests",
        json={
            "full_name": "Priya Sharma", "email": "priya@example.com", "phone": "9876543210",
            "company_name": "Sharma Cement Traders", "industry_slug": "building_materials",
            "message": "We manage 3 warehouses and need dispatch tracking.", "source_page": "/industries/building-materials",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["full_name"] == "Priya Sharma"
    assert body["email"] == "priya@example.com"
    assert "id" in body and "created_at" in body


def test_demo_request_rejects_invalid_email():
    resp = client.post(
        "/api/v1/public/demo-requests",
        json={"full_name": "Test", "email": "not-an-email", "company_name": "Test Co"},
    )
    assert resp.status_code == 422


def test_demo_request_rejects_unknown_industry_slug():
    resp = client.post(
        "/api/v1/public/demo-requests",
        json={"full_name": "Test", "email": "test@example.com", "company_name": "Test Co", "industry_slug": "not_a_real_industry"},
    )
    assert resp.status_code == 422


def test_demo_request_industry_slug_and_phone_and_message_are_optional():
    resp = client.post(
        "/api/v1/public/demo-requests",
        json={"full_name": "Minimal Submitter", "email": "minimal@example.com", "company_name": "Minimal Co"},
    )
    assert resp.status_code == 201, resp.text
