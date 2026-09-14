"""Support tickets (ADR-020): the only two tables in the schema whose RLS
policy has a platform-bypass clause. Verifies the tenant side stays
strictly tenant-isolated, the platform side gets a real cross-tenant
inbox, and a reply from either side lands correctly attributed.
"""
import uuid

from fastapi.testclient import TestClient

from app.db import SessionLocal
from app.main import app
from app.models.platform_admin import PlatformAdmin
from app.security import hash_password

client = TestClient(app)


def _make_platform_admin(email: str) -> str:
    db = SessionLocal()
    try:
        db.add(PlatformAdmin(email=email, full_name="Test Admin", hashed_password=hash_password("platform-pass-123")))
        db.commit()
    finally:
        db.close()
    login_resp = client.post("/api/v1/platform/auth/login", json={"email": email, "password": "platform-pass-123"})
    return login_resp.json()["access_token"]


def _signed_up_tenant_token(slug: str) -> str:
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


def test_tenant_can_file_and_reply_to_its_own_ticket():
    slug = f"support-{uuid.uuid4().hex[:8]}"
    token = _signed_up_tenant_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/support-tickets", headers=headers,
        json={"subject": "Cannot export GST report", "body": "The export button does nothing.", "priority": "high"},
    )
    assert create.status_code == 201
    ticket = create.json()
    assert ticket["status"] == "open"
    assert ticket["priority"] == "high"
    assert len(ticket["messages"]) == 1

    listing = client.get("/api/v1/support-tickets", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    reply = client.post(
        f"/api/v1/support-tickets/{ticket['id']}/messages", headers=headers, json={"body": "Still broken after retry."}
    )
    assert reply.status_code == 201
    assert reply.json()["author_user_id"] is not None
    assert reply.json()["author_platform_admin_id"] is None

    detail = client.get(f"/api/v1/support-tickets/{ticket['id']}", headers=headers)
    assert len(detail.json()["messages"]) == 2


def test_a_tenant_cannot_see_another_tenants_ticket():
    slug_a = f"support-a-{uuid.uuid4().hex[:8]}"
    slug_b = f"support-b-{uuid.uuid4().hex[:8]}"
    token_a = _signed_up_tenant_token(slug_a)
    token_b = _signed_up_tenant_token(slug_b)

    create = client.post(
        "/api/v1/support-tickets", headers={"Authorization": f"Bearer {token_a}"},
        json={"subject": "Tenant A issue", "body": "Help."},
    )
    ticket_id = create.json()["id"]

    cross_tenant_read = client.get(f"/api/v1/support-tickets/{ticket_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert cross_tenant_read.status_code == 404

    b_listing = client.get("/api/v1/support-tickets", headers={"Authorization": f"Bearer {token_b}"})
    assert b_listing.json() == []


def test_platform_admin_sees_ticket_across_tenants_and_can_reply_and_resolve():
    slug = f"support-platform-{uuid.uuid4().hex[:8]}"
    tenant_token = _signed_up_tenant_token(slug)
    admin_token = _make_platform_admin(f"platform-support-{uuid.uuid4().hex[:8]}@materialos.example")

    create = client.post(
        "/api/v1/support-tickets", headers={"Authorization": f"Bearer {tenant_token}"},
        json={"subject": "Billing question", "body": "Why was I charged twice?"},
    )
    ticket_id = create.json()["id"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    inbox = client.get("/api/v1/platform/support-tickets", headers=admin_headers, params={"status": "open"})
    assert inbox.status_code == 200
    matching = [t for t in inbox.json() if t["id"] == ticket_id]
    assert len(matching) == 1
    assert matching[0]["tenant_slug"] == slug

    detail = client.get(f"/api/v1/platform/support-tickets/{ticket_id}", headers=admin_headers)
    assert detail.status_code == 200
    assert len(detail.json()["messages"]) == 1

    reply = client.post(
        f"/api/v1/platform/support-tickets/{ticket_id}/messages", headers=admin_headers,
        json={"body": "That was a duplicate charge, refunded."},
    )
    assert reply.status_code == 201
    assert reply.json()["author_platform_admin_id"] is not None

    # An admin reply auto-progresses a fresh "open" ticket to "in_progress".
    after_reply = client.get(f"/api/v1/platform/support-tickets/{ticket_id}", headers=admin_headers)
    assert after_reply.json()["status"] == "in_progress"

    resolved = client.patch(f"/api/v1/platform/support-tickets/{ticket_id}", headers=admin_headers, json={"status": "resolved"})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"

    # The tenant sees the admin's reply and the resolved status too.
    tenant_view = client.get(f"/api/v1/support-tickets/{ticket_id}", headers={"Authorization": f"Bearer {tenant_token}"})
    assert tenant_view.json()["status"] == "resolved"
    assert any(m["author_platform_admin_id"] for m in tenant_view.json()["messages"])

    # Replying as the tenant re-opens a resolved ticket.
    reopen = client.post(
        f"/api/v1/support-tickets/{ticket_id}/messages", headers={"Authorization": f"Bearer {tenant_token}"},
        json={"body": "Actually I still don't see the refund."},
    )
    assert reopen.status_code == 201
    reopened_ticket = client.get(f"/api/v1/support-tickets/{ticket_id}", headers={"Authorization": f"Bearer {tenant_token}"})
    assert reopened_ticket.json()["status"] == "open"


def test_a_tenant_token_cannot_access_the_platform_support_inbox():
    slug = f"support-isolation-{uuid.uuid4().hex[:8]}"
    tenant_token = _signed_up_tenant_token(slug)
    resp = client.get("/api/v1/platform/support-tickets", headers={"Authorization": f"Bearer {tenant_token}"})
    assert resp.status_code == 401
