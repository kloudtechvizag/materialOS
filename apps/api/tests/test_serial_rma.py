"""Serial/IMEI registry + RMA lifecycle. The RMA state machine is the
real business rule here -- an RMA can't skip straight from "requested"
to "resolved", and a rejected/resolved RMA is terminal.
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


def test_serial_unit_and_rma_full_lifecycle():
    slug = f"rma-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    item_resp = client.post(
        "/api/v1/items", headers=headers,
        json={"sku": "IMEI-TEST-1", "name": "Test Phone", "base_uom": "PCS", "gst_rate": "18", "standard_price": "20000", "standard_cost": "15000"},
    )
    assert item_resp.status_code == 201, item_resp.text
    item_id = item_resp.json()["id"]

    serial_resp = client.post(
        "/api/v1/serial-units", headers=headers,
        json={"item_id": item_id, "serial_number": "IMEI123456789012345", "notes": "First unit"},
    )
    assert serial_resp.status_code == 201, serial_resp.text
    serial = serial_resp.json()
    assert serial["status"] == "in_stock"

    # Same serial number for the same item twice is rejected by the DB
    # constraint (surfaced as a real error, not silently duplicated).
    dup_resp = client.post(
        "/api/v1/serial-units", headers=headers, json={"item_id": item_id, "serial_number": "IMEI123456789012345"},
    )
    assert dup_resp.status_code >= 400

    mark_sold = client.patch(f"/api/v1/serial-units/{serial['id']}", headers=headers, json={"status": "sold"})
    assert mark_sold.status_code == 200
    assert mark_sold.json()["status"] == "sold"

    customer_resp = client.post("/api/v1/customers", headers=headers, json={"name": "RMA Test Customer"})
    customer_id = customer_resp.json()["id"]

    rma_resp = client.post(
        "/api/v1/rma-requests", headers=headers,
        json={"serial_unit_id": serial["id"], "customer_id": customer_id, "reason": "Screen not turning on"},
    )
    assert rma_resp.status_code == 201, rma_resp.text
    rma = rma_resp.json()
    assert rma["number"].startswith("RMA")
    assert rma["status"] == "requested"

    # Registering the RMA marks the unit under repair.
    unit_after_rma = client.get("/api/v1/serial-units", headers=headers, params={"item_id": item_id}).json()
    assert next(u for u in unit_after_rma if u["id"] == serial["id"])["status"] == "under_repair"

    # Can't skip straight to resolved from requested.
    skip_resp = client.patch(f"/api/v1/rma-requests/{rma['id']}", headers=headers, json={"status": "resolved", "resolution": "repaired"})
    assert skip_resp.status_code == 400

    approve_resp = client.patch(f"/api/v1/rma-requests/{rma['id']}", headers=headers, json={"status": "approved"})
    assert approve_resp.status_code == 200

    repair_resp = client.patch(f"/api/v1/rma-requests/{rma['id']}", headers=headers, json={"status": "in_repair"})
    assert repair_resp.status_code == 200

    resolve_resp = client.patch(
        f"/api/v1/rma-requests/{rma['id']}", headers=headers,
        json={"status": "resolved", "resolution": "repaired", "resolution_notes": "Replaced the display"},
    )
    assert resolve_resp.status_code == 200
    resolved = resolve_resp.json()
    assert resolved["resolution"] == "repaired"
    assert resolved["resolved_date"] is not None

    unit_after_repair = client.get("/api/v1/serial-units", headers=headers, params={"item_id": item_id}).json()
    assert next(u for u in unit_after_repair if u["id"] == serial["id"])["status"] == "in_stock"

    # A resolved RMA is terminal -- no further transitions allowed.
    reopen_resp = client.patch(f"/api/v1/rma-requests/{rma['id']}", headers=headers, json={"status": "approved"})
    assert reopen_resp.status_code == 400


def test_rma_isolated_by_tenant():
    slug_a = f"rma-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"rma-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    list_a = client.get("/api/v1/rma-requests", headers={"Authorization": f"Bearer {token_a}"})
    list_b = client.get("/api/v1/rma-requests", headers={"Authorization": f"Bearer {token_b}"})
    assert list_a.status_code == 200 and list_a.json() == []
    assert list_b.status_code == 200 and list_b.json() == []
