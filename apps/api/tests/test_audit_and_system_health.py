"""ADR-013: exposing the pre-existing audit_log trigger data (sec35-38)
and real, live system-health checks (sec39-40)."""

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


def test_audit_log_captures_item_creation_and_is_readable_via_api():
    slug = f"audit-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/items",
        json={"sku": "AUDIT-TEST", "name": "Audit Test Item", "base_uom": "PCS", "gst_rate": 18, "standard_price": 100},
        headers=headers,
    )
    assert create_resp.status_code == 201, create_resp.text
    item_id = create_resp.json()["id"]

    logs_resp = client.get(f"/api/v1/audit-logs?table_name=items&row_id={item_id}", headers=headers)
    assert logs_resp.status_code == 200, logs_resp.text
    logs = logs_resp.json()
    assert len(logs) == 1
    assert logs[0]["action"] == "INSERT"
    assert logs[0]["new_data"]["sku"] == "AUDIT-TEST"
    assert logs[0]["old_data"] is None

    tables_resp = client.get("/api/v1/audit-logs/tables", headers=headers)
    assert "items" in tables_resp.json()


def test_audit_log_is_tenant_isolated():
    slug_a = f"audit-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"audit-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    client.post(
        "/api/v1/items",
        json={"sku": "TENANT-A-ITEM", "name": "Tenant A Item", "base_uom": "PCS", "gst_rate": 18, "standard_price": 100},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    logs_b = client.get("/api/v1/audit-logs?table_name=items", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert all(log.get("new_data", {}).get("sku") != "TENANT-A-ITEM" for log in logs_b)


def test_system_health_reports_real_component_statuses():
    slug = f"health-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)

    resp = client.get("/api/v1/system-health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["overall"] in ("healthy", "degraded", "unavailable")
    names = {c["name"] for c in body["components"]}
    assert names == {"database", "redis", "object_storage", "background_worker"}
    database_component = next(c for c in body["components"] if c["name"] == "database")
    # This request only succeeded because the DB is actually reachable
    # (get_db_tenant needs it) -- the check must reflect that truthfully.
    assert database_component["status"] == "healthy"
