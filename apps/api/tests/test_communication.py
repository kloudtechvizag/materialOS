import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.communication import WhatsAppSessionStatusOut

client = TestClient(app)


def _signed_up_token(slug: str, industry_slug: str = "building_materials") -> tuple[str, str]:
    resp = client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": f"Tenant {slug}",
            "tenant_slug": slug,
            "company_name": f"Company {slug}",
            "company_legal_name": f"Company {slug} Pvt Ltd",
            "owner_full_name": "Owner",
            "owner_email": f"owner-{slug}@example.com",
            "owner_password": "correct-horse-battery-staple",
            "industry_slug": industry_slug,
        },
    )
    assert resp.status_code == 201, resp.text
    tenant_id = resp.json()["tenant_id"]

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    assert login_resp.status_code == 200, login_resp.text
    return login_resp.json()["access_token"], tenant_id


def test_communication_config_and_defaults():
    slug = f"comm-{uuid.uuid4().hex[:8]}"
    token, tenant_id = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Fetch config: creates default row and seeds standard templates
    resp = client.get("/api/v1/communication/config", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["session_status"] == "STOPPED"
    assert data["auto_reject_calls"] is True
    assert "whatsapp" in data["enabled_channels"]

    # 2. Update config
    update_resp = client.put(
        "/api/v1/communication/config",
        headers=headers,
        json={
            "auto_reject_message": "Custom deflection text for testing.",
            "sms_provider": "fast2sms",
            "enabled_channels": ["whatsapp", "sms"],
        },
    )
    assert update_resp.status_code == 200, update_resp.text
    updated = update_resp.json()
    assert updated["auto_reject_message"] == "Custom deflection text for testing."
    assert updated["sms_provider"] == "fast2sms"
    assert "sms" in updated["enabled_channels"]


def test_communication_templates():
    slug = f"comm-tpl-{uuid.uuid4().hex[:8]}"
    token, _ = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # List default templates
    resp = client.get("/api/v1/communication/templates", headers=headers)
    assert resp.status_code == 200, resp.text
    templates = resp.json()
    slugs = {t["slug"] for t in templates}
    assert "quote_created" in slugs
    assert "dispatch_challan" in slugs
    assert "student_absent" in slugs
    assert "fee_invoice" in slugs

    # Create new custom template
    new_tpl_slug = f"custom_notice_{uuid.uuid4().hex[:4]}"
    create_resp = client.post(
        "/api/v1/communication/templates",
        headers=headers,
        json={
            "slug": new_tpl_slug,
            "name": "Custom Notice",
            "category": "contractor",
            "whatsapp_body": "Notice for site *{{site_name}}*: Joint inspection on {{date}}.",
            "sample_variables": {"site_name": "Package 4", "date": "Tomorrow"},
        },
    )
    assert create_resp.status_code == 201, create_resp.text
    assert create_resp.json()["slug"] == new_tpl_slug

    # Prevent duplicate slug
    dup_resp = client.post(
        "/api/v1/communication/templates",
        headers=headers,
        json={
            "slug": new_tpl_slug,
            "name": "Duplicate Notice",
            "whatsapp_body": "Duplicate text",
        },
    )
    assert dup_resp.status_code == 409, dup_resp.text


def test_whatsapp_session_lifecycle():
    slug = f"comm-sess-{uuid.uuid4().hex[:8]}"
    token, _ = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # Query status
    status_resp = client.get("/api/v1/communication/whatsapp/session/status", headers=headers)
    assert status_resp.status_code == 200, status_resp.text
    assert "session_id" in status_resp.json()

    # Query QR code
    qr_resp = client.get("/api/v1/communication/whatsapp/session/qr", headers=headers)
    assert qr_resp.status_code == 200, qr_resp.text
    assert qr_resp.json()["expires_in_seconds"] == 45

    # Trigger session stop
    stop_resp = client.post("/api/v1/communication/whatsapp/session/stop", headers=headers)
    assert stop_resp.status_code == 200, stop_resp.text
    assert stop_resp.json()["status"] == "STOPPED"


def test_send_whatsapp_message():
    slug = f"comm-msg-{uuid.uuid4().hex[:8]}"
    token, _ = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # Dispatch message with template
    send_resp = client.post(
        "/api/v1/communication/whatsapp/send",
        headers=headers,
        json={
            "recipient_phone": "+91 98480 12345",
            "recipient_name": "Test Client",
            "template_slug": "quote_created",
            "variables": {
                "customer_name": "Sri Balaji Builders",
                "company_name": "Apex Suppliers",
                "quote_no": "QT-991",
                "amount": "85,000",
                "valid_until": "10-Oct-2026",
            },
        },
    )
    assert send_resp.status_code == 200, send_resp.text
    msg = send_resp.json()
    assert msg["recipient_phone"] == "919848012345"
    assert "Sri Balaji Builders" in msg["rendered_text"]
    assert "QT-991" in msg["rendered_text"]

    # List messages
    list_resp = client.get("/api/v1/communication/messages", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    messages = list_resp.json()
    assert len(messages) >= 1
    assert messages[0]["recipient_phone"] == "919848012345"


def test_waha_inbound_webhooks():
    slug = f"comm-wh-{uuid.uuid4().hex[:8]}"
    token, tenant_id = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    # Initialize config
    client.get("/api/v1/communication/config", headers=headers)

    # 1. Send session.status webhook event
    status_hook_resp = client.post(
        f"/api/v1/communication/webhooks/waha?tenant_id={tenant_id}",
        json={
            "event": "session.status",
            "session": f"tenant_{tenant_id}",
            "payload": {
                "status": "WORKING",
                "me": {"id": "919848012345@c.us", "pushName": "Apex Enterprise WhatsApp"},
            },
        },
    )
    assert status_hook_resp.status_code == 200, status_hook_resp.text
    assert status_hook_resp.json()["status"] == "ok"

    # Verify config updated
    conf_resp = client.get("/api/v1/communication/config", headers=headers)
    assert conf_resp.json()["session_status"] == "WORKING"
    assert conf_resp.json()["phone_number"] == "919848012345"
    assert conf_resp.json()["push_name"] == "Apex Enterprise WhatsApp"

    # 2. Send inbound message event
    msg_hook_resp = client.post(
        f"/api/v1/communication/webhooks/waha?tenant_id={tenant_id}",
        json={
            "event": "message",
            "session": f"tenant_{tenant_id}",
            "payload": {
                "id": "WAMID_TEST_12345",
                "from": "919440199999@c.us",
                "fromMe": False,
                "body": "Please send quotation for 10 MT steel",
                "_data": {"notifyName": "Kiran Rao"},
            },
        },
    )
    assert msg_hook_resp.status_code == 200, msg_hook_resp.text
    assert msg_hook_resp.json()["status"] == "ok"


def test_cross_tenant_communication_isolation():
    slug_a = f"comm-a-{uuid.uuid4().hex[:8]}"
    token_a, _ = _signed_up_token(slug_a)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    slug_b = f"comm-b-{uuid.uuid4().hex[:8]}"
    token_b, _ = _signed_up_token(slug_b)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Tenant A sends a message
    client.post(
        "/api/v1/communication/whatsapp/send",
        headers=headers_a,
        json={
            "recipient_phone": "919999999999",
            "message_text": "Secret Message from Tenant A",
        },
    )

    # Tenant B queries messages: must NOT see Tenant A's message
    msgs_b = client.get("/api/v1/communication/messages", headers=headers_b).json()
    for m in msgs_b:
        assert m["rendered_text"] != "Secret Message from Tenant A"
