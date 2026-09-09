"""Lead pipeline: converting a lead must create a real, independent
Customer row -- not just flip a status flag -- so everything else that
already depends on Customer (credit, invoices, portal access) keeps
working unchanged.
"""
import uuid
from decimal import Decimal

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


def test_lead_create_list_and_convert_creates_real_customer():
    slug = f"lead-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/leads", headers=headers,
        json={"name": "Ramesh Kumar", "company_name": "Kumar Constructions", "phone": "9876543210", "source": "Referral", "estimated_value": "500000"},
    )
    assert create_resp.status_code == 201, create_resp.text
    lead = create_resp.json()
    assert lead["status"] == "new"
    assert lead["converted_customer_id"] is None

    list_resp = client.get("/api/v1/leads", headers=headers)
    assert list_resp.status_code == 200
    assert any(l["id"] == lead["id"] for l in list_resp.json())

    patch_resp = client.patch(f"/api/v1/leads/{lead['id']}", headers=headers, json={"status": "qualified"})
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == "qualified"

    convert_resp = client.post(
        f"/api/v1/leads/{lead['id']}/convert", headers=headers,
        json={"billing_state": "Andhra Pradesh", "credit_limit": "100000", "credit_days": 30},
    )
    assert convert_resp.status_code == 200, convert_resp.text
    body = convert_resp.json()
    assert body["lead"]["status"] == "won"
    assert body["lead"]["converted_customer_id"] == body["customer"]["id"]
    assert body["customer"]["name"] == "Kumar Constructions"
    assert Decimal(body["customer"]["credit_limit"]) == Decimal("100000")
    assert body["customer"]["billing_state"] == "Andhra Pradesh"

    # The new customer is a real, independent row -- findable via the
    # ordinary customers list, not some derived view of the lead.
    customers_resp = client.get("/api/v1/customers", headers=headers)
    assert any(c["id"] == body["customer"]["id"] for c in customers_resp.json())

    # Converting twice must fail -- a lead converts to exactly one customer.
    second_convert = client.post(f"/api/v1/leads/{lead['id']}/convert", headers=headers, json={})
    assert second_convert.status_code == 400


def test_lost_lead_cannot_be_converted():
    slug = f"lead-lost-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    lead = client.post("/api/v1/leads", headers=headers, json={"name": "Dead End Co"}).json()
    client.patch(f"/api/v1/leads/{lead['id']}", headers=headers, json={"status": "lost", "lost_reason": "Went with a competitor"})

    convert_resp = client.post(f"/api/v1/leads/{lead['id']}/convert", headers=headers, json={})
    assert convert_resp.status_code == 400


def test_lead_isolated_by_tenant():
    slug_a = f"lead-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"lead-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    lead = client.post("/api/v1/leads", headers={"Authorization": f"Bearer {token_a}"}, json={"name": "Tenant A Lead"}).json()

    cross_tenant_patch = client.patch(
        f"/api/v1/leads/{lead['id']}", headers={"Authorization": f"Bearer {token_b}"}, json={"status": "qualified"},
    )
    assert cross_tenant_patch.status_code == 404

    tenant_b_list = client.get("/api/v1/leads", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert all(l["id"] != lead["id"] for l in tenant_b_list)
