"""ADR-014: the subscription lifecycle exercised the way a real client
would -- HTTP end to end, through the actual FastAPI app, not by
calling service functions directly. Covers signup's automatic trial
subscription, the downgrade-blocked gate (spec sec24), a feature gate
actually denying an endpoint, and the checkout -> webhook -> paid
pipeline including idempotent replay.
"""

import json
import uuid

from fastapi.testclient import TestClient

from app.billing.gateway import SandboxPaymentProvider
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


def test_signup_creates_a_trialing_subscription_on_the_default_plan():
    slug = f"billflow-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/subscription", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "trialing"
    assert body["plan"]["is_default_signup_plan"] is True
    assert body["trial_ends_at"] is not None


def test_downgrade_blocked_when_over_target_plans_user_limit():
    slug = f"billflow-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    for i in range(4):  # owner + 4 = 5 users, over Starter's limit of 3
        client.post(
            "/api/v1/users", headers=headers,
            json={"email": f"user{i}-{slug}@example.com", "full_name": f"User {i}", "password": "correct-horse-battery-staple"},
        )

    resp = client.post("/api/v1/subscription/downgrade", headers=headers, json={"plan_slug": "starter", "billing_cycle": "monthly"})
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert body["error"]["code"] == "PLAN_DOWNGRADE_BLOCKED"
    violation_keys = {v["limit_key"] for v in body["error"]["details"]["violations"]}
    assert "users" in violation_keys


def test_feature_gate_denies_pos_on_free_plan_with_402():
    slug = f"billflow-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    downgrade_resp = client.post("/api/v1/subscription/downgrade", headers=headers, json={"plan_slug": "free", "billing_cycle": "monthly"})
    assert downgrade_resp.status_code == 200, downgrade_resp.text

    pos_resp = client.post(
        "/api/v1/pos/sales", headers=headers,
        json={"warehouse_id": str(uuid.uuid4()), "lines": [], "cash_amount": "0", "upi_amount": "0", "card_amount": "0", "tendered_amount": "0"},
    )
    assert pos_resp.status_code == 402, pos_resp.text
    assert pos_resp.json()["error"]["code"] == "FEATURE_NOT_AVAILABLE"


def test_checkout_and_webhook_activate_subscription_and_replay_is_idempotent():
    slug = f"billflow-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # Still trialing -> proration is intentionally skipped (see
    # subscriptions.py's _change_plan docstring), no invoice yet.
    upgrade_resp = client.post("/api/v1/subscription/upgrade", headers=headers, json={"plan_slug": "business", "billing_cycle": "monthly"})
    assert upgrade_resp.status_code == 200, upgrade_resp.text
    assert upgrade_resp.json()["invoice"] is None

    # Cancel immediately, then reactivate -- reactivate always generates a
    # fresh, full-price invoice for a genuinely lapsed subscription, which
    # is what exercises the checkout/webhook path end to end here.
    cancel_resp = client.post("/api/v1/subscription/cancel", headers=headers, json={"at_period_end": False})
    assert cancel_resp.status_code == 200, cancel_resp.text
    assert cancel_resp.json()["status"] == "cancelled"

    reactivate_resp = client.post("/api/v1/subscription/reactivate", headers=headers)
    assert reactivate_resp.status_code == 200, reactivate_resp.text
    invoice = reactivate_resp.json()["invoice"]
    assert invoice is not None

    checkout_resp = client.post("/api/v1/billing/checkout", headers=headers, json={"invoice_id": invoice["id"]})
    assert checkout_resp.status_code == 200, checkout_resp.text
    checkout_body = checkout_resp.json()
    assert checkout_body["is_sandbox"] is True
    order_id = checkout_body["order_id"]

    payload = json.dumps({
        "event": "payment.success", "tenant_id": _tenant_id_from_token(token),
        "order_id": order_id, "payment_id": "SANDBOX_pay_test", "method": "upi",
    }).encode()
    signature = SandboxPaymentProvider().sign(payload)

    webhook_resp = client.post("/api/v1/billing/webhooks", content=payload, headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"})
    assert webhook_resp.status_code == 200, webhook_resp.text

    invoices_resp = client.get("/api/v1/subscription/invoices", headers=headers)
    matching = [i for i in invoices_resp.json() if i["id"] == invoice["id"]]
    assert matching[0]["status"] == "paid"

    # Replay -- must not error and must not double-process.
    replay_resp = client.post("/api/v1/billing/webhooks", content=payload, headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"})
    assert replay_resp.status_code == 200, replay_resp.text

    payments_resp = client.get("/api/v1/subscription/payments", headers=headers)
    payments = [p for p in payments_resp.json() if p["provider_order_id"] == order_id]
    assert len(payments) == 1
    assert payments[0]["status"] == "succeeded"


def test_webhook_rejects_invalid_signature():
    payload = json.dumps({"event": "payment.success", "tenant_id": str(uuid.uuid4()), "order_id": "nonexistent"}).encode()
    resp = client.post("/api/v1/billing/webhooks", content=payload, headers={"X-Webhook-Signature": "not-a-real-signature", "Content-Type": "application/json"})
    assert resp.status_code == 401


def _tenant_id_from_token(token: str) -> str:
    import base64

    payload_b64 = token.split(".")[1]
    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded))
    return payload["tenant_id"]
