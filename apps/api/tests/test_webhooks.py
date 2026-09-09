"""Webhook subscriptions + real delivery (HMAC-signed HTTP POST, retry/
dead-letter). Delivery itself runs as a Celery task
(deliver_webhook_task) -- these tests call the task function directly
(Celery's eager-mode-free "just call it like a function" pattern,
already how this test suite exercises other @celery_app.task
functions) rather than requiring a running worker.
"""
import uuid

import httpx
from fastapi.testclient import TestClient

from app.db import set_session_context
from app.main import app
from app.models.webhooks import WebhookDelivery
from app.services.webhooks import deliver_webhook_task, sign_payload, validate_webhook_url

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


def test_webhook_url_ssrf_guard_rejects_private_and_loopback():
    for bad_url in ("http://localhost:8000/hook", "http://127.0.0.1/hook", "http://169.254.169.254/latest/meta-data", "ftp://example.com/hook"):
        try:
            validate_webhook_url(bad_url)
            assert False, f"{bad_url} should have been rejected"
        except Exception as exc:
            assert "AppError" in type(exc).__name__ or "webhook" in str(exc).lower() or "url" in str(exc).lower()


def test_webhook_subscription_rejects_unknown_event_type():
    slug = f"wh-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/api/v1/webhook-subscriptions", headers=headers,
        json={"url": "https://example.com/hook", "event_types": ["not.a.real.event"]},
    )
    assert resp.status_code == 400


def test_webhook_subscription_create_returns_secret_once():
    slug = f"wh-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = client.post(
        "/api/v1/webhook-subscriptions", headers=headers,
        json={"url": "https://example.com/hook", "event_types": ["sales_order.created", "invoice.created"], "description": "Test hook"},
    )
    assert create_resp.status_code == 201, create_resp.text
    body = create_resp.json()
    assert len(body["secret"]) == 64  # 32 bytes hex

    list_resp = client.get("/api/v1/webhook-subscriptions", headers=headers)
    assert list_resp.status_code == 200
    assert "secret" not in list_resp.json()[0]  # never leaks on subsequent reads

    events_resp = client.get("/api/v1/webhooks/events", headers=headers)
    assert events_resp.status_code == 200
    assert {"sales_order.created", "invoice.created"} <= {e["event_type"] for e in events_resp.json()}


def test_webhook_delivery_signs_payload_and_records_success(db, tenant_ctx, monkeypatch):
    tenant = tenant_ctx["tenant"]
    from app.models.webhooks import WebhookSubscription

    subscription = WebhookSubscription(
        tenant_id=tenant.id, url="https://example.com/hook", event_types=["sales_order.created"], secret="test-secret-123", is_active=True,
    )
    db.add(subscription)
    db.flush()
    delivery = WebhookDelivery(
        tenant_id=tenant.id, webhook_subscription_id=subscription.id, event_type="sales_order.created",
        payload={"id": "abc", "number": "SO-1"}, status="pending",
    )
    db.add(delivery)
    db.commit()

    captured = {}

    def fake_post(url, *, content, headers, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["body"] = content
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.webhooks.httpx.post", fake_post)
    deliver_webhook_task(delivery_id=str(delivery.id), tenant_id=str(tenant.id))

    # db.commit() above ended the transaction SET LOCAL app.current_tenant
    # was scoped to (same reason services/permissions.py's docstring warns
    # ensure_permission_catalog needs a fresh call after a commit) --
    # without resetting it, RLS sees no tenant context and hides the row.
    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    db.expire_all()
    refreshed = db.get(WebhookDelivery, delivery.id)
    assert refreshed.status == "sent"
    assert refreshed.response_status == 200
    assert refreshed.attempt_count == 1

    expected_signature = sign_payload("test-secret-123", captured["body"])
    assert captured["headers"]["X-MaterialOS-Signature"] == f"sha256={expected_signature}"
    assert captured["headers"]["X-MaterialOS-Event"] == "sales_order.created"


def test_webhook_delivery_dead_letters_after_max_attempts(db, tenant_ctx, monkeypatch):
    tenant = tenant_ctx["tenant"]
    from app.models.webhooks import WebhookSubscription

    subscription = WebhookSubscription(
        tenant_id=tenant.id, url="https://example.com/hook", event_types=["invoice.created"], secret="s", is_active=True,
    )
    db.add(subscription)
    db.flush()
    delivery = WebhookDelivery(
        tenant_id=tenant.id, webhook_subscription_id=subscription.id, event_type="invoice.created",
        payload={}, status="pending", attempt_count=2,  # about to become the 3rd (final) attempt
    )
    db.add(delivery)
    db.commit()

    def fake_post(url, *, content, headers, timeout):
        raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr("app.services.webhooks.httpx.post", fake_post)

    try:
        deliver_webhook_task(delivery_id=str(delivery.id), tenant_id=str(tenant.id))
    except Exception:
        pass  # self.retry() raises outside session_scope when should_retry -- not the case here at max attempts

    set_session_context(db, tenant_id=str(tenant.id), user_id=None)
    db.expire_all()
    refreshed = db.get(WebhookDelivery, delivery.id)
    assert refreshed.status == "dead_letter"
    assert refreshed.attempt_count == 3


def test_webhooks_tenant_isolated():
    slug_a = f"wh-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"wh-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_token(slug_a)
    token_b = _signed_up_token(slug_b)

    client.post(
        "/api/v1/webhook-subscriptions", headers={"Authorization": f"Bearer {token_a}"},
        json={"url": "https://example.com/hook", "event_types": ["invoice.created"]},
    )
    list_b = client.get("/api/v1/webhook-subscriptions", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.json() == []
