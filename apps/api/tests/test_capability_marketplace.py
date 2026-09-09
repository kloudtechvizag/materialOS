"""Capability marketplace: purchasing a real SubscriptionAddon
(services/subscriptions.py::purchase_addon) against the real
AddonOffering catalog (services/billing_plans.py's ADDON_CATALOG) --
end to end through the actual checkout/simulate pipeline, the same one
plan upgrades already use (test_billing_flow.py).
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


def _printing_pack_offering_id(headers: dict) -> str:
    addons = client.get("/api/v1/pricing/addons", headers=headers).json()
    return next(a["id"] for a in addons if a["code"] == "addon.printing_pack")


def test_installing_addon_grants_the_feature_and_generates_an_invoice():
    slug = f"mktplace-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    subscription = client.get("/api/v1/subscription", headers=headers).json()
    assert "module.printing" not in subscription["plan"]["features"]  # growth (default signup) doesn't include it

    offering_id = _printing_pack_offering_id(headers)
    purchase_resp = client.post(
        "/api/v1/subscription/addons", headers=headers,
        json={"addon_offering_id": offering_id, "billing_cycle": "yearly"},
    )
    assert purchase_resp.status_code == 201, purchase_resp.text
    body = purchase_resp.json()
    assert body["addon"]["code"] == "addon.printing_pack"
    assert body["addon"]["is_active"] is True
    assert body["invoice"]["total"] != "0.00"

    active = client.get("/api/v1/subscription/addons", headers=headers).json()
    assert len(active) == 1
    assert active[0]["code"] == "addon.printing_pack"

    checkout_resp = client.post("/api/v1/billing/checkout", headers=headers, json={"invoice_id": body["invoice"]["id"]})
    assert checkout_resp.status_code == 200, checkout_resp.text
    payment_id = checkout_resp.json()["payment"]["id"]

    simulate_resp = client.post(f"/api/v1/billing/checkout/{payment_id}/simulate", headers=headers, json={"succeed": True})
    assert simulate_resp.status_code == 200, simulate_resp.text
    assert simulate_resp.json()["status"] == "succeeded"


def test_installing_the_same_addon_twice_is_rejected():
    slug = f"mktplace-dup-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    offering_id = _printing_pack_offering_id(headers)

    first = client.post("/api/v1/subscription/addons", headers=headers, json={"addon_offering_id": offering_id, "billing_cycle": "yearly"})
    assert first.status_code == 201, first.text

    second = client.post("/api/v1/subscription/addons", headers=headers, json={"addon_offering_id": offering_id, "billing_cycle": "yearly"})
    assert second.status_code == 409, second.text


def test_cancelling_an_addon_removes_it_from_active_list():
    slug = f"mktplace-cancel-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    offering_id = _printing_pack_offering_id(headers)

    purchase_resp = client.post("/api/v1/subscription/addons", headers=headers, json={"addon_offering_id": offering_id, "billing_cycle": "yearly"})
    addon_id = purchase_resp.json()["addon"]["id"]

    cancel_resp = client.post(f"/api/v1/subscription/addons/{addon_id}/cancel", headers=headers)
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["is_active"] is False

    active = client.get("/api/v1/subscription/addons", headers=headers).json()
    assert active == []

    again = client.post(f"/api/v1/subscription/addons/{addon_id}/cancel", headers=headers)
    assert again.status_code == 404


def test_installing_unknown_addon_offering_rejected():
    slug = f"mktplace-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/subscription/addons", headers=headers,
        json={"addon_offering_id": str(uuid.uuid4()), "billing_cycle": "yearly"},
    )
    assert resp.status_code == 422


def test_addons_are_tenant_isolated():
    slug_a = f"mktplace-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"mktplace-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    offering_id = _printing_pack_offering_id(headers_a)
    client.post("/api/v1/subscription/addons", headers=headers_a, json={"addon_offering_id": offering_id, "billing_cycle": "yearly"})

    assert client.get("/api/v1/subscription/addons", headers=headers_a).json() != []
    assert client.get("/api/v1/subscription/addons", headers=headers_b).json() == []
