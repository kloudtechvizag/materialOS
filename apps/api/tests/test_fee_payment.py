"""ADR-042: guardian-initiated fee payment, exercised through the real
HTTP API -- checkout -> (sandbox) webhook -> a real Receipt, mirroring
test_billing_flow.py's own checkout/webhook/idempotent-replay coverage
for the platform's pre-existing subscription billing.
"""
import json
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.billing.gateway import SandboxPaymentProvider
from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str, industry_slug: str = "school_education") -> tuple[str, str]:
    signup = client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": industry_slug,
        },
    ).json()
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"], signup["tenant_id"]


def _login(slug: str, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _setup_tenant_with_invoice_and_portal():
    slug = f"feepay-{uuid.uuid4().hex[:8]}"
    staff_token, tenant_id = _signed_up_token(slug)
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    branch_id = client.get("/api/v1/branches", headers=staff_headers).json()[0]["id"]

    year = client.post(
        "/api/v1/academic-years", headers=staff_headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=staff_headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 3", "sequence": 3}).json()
    section = client.post("/api/v1/sections", headers=staff_headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=staff_headers,
        json={"branch_id": branch_id, "first_name": "Zara", "last_name": "Fee", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()
    guardian = client.post("/api/v1/guardians", headers=staff_headers, json={"full_name": "Parent of Zara"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=staff_headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})
    portal_access = client.post(
        f"/api/v1/guardians/{guardian['id']}/portal-access", headers=staff_headers,
        json={"email": f"parent-{slug}@example.com", "password": "guardian-pass-123", "full_name": "Parent of Zara"},
    )
    assert portal_access.status_code == 201, portal_access.text

    fee_head = client.post("/api/v1/fee-heads", headers=staff_headers, json={"name": "Tuition Fee", "code": "TUITION"}).json()
    structure_item = client.post(
        "/api/v1/fee-structure-items", headers=staff_headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "5000", "due_date": "2026-07-15"},
    ).json()
    gen = client.post(
        "/api/v1/fee-invoices/generate", headers=staff_headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    ).json()
    fee_invoice_id = gen["created"][0]["id"]

    guardian_token = _login(slug, f"parent-{slug}@example.com", "guardian-pass-123")
    guardian_headers = {"Authorization": f"Bearer {guardian_token}"}
    return slug, tenant_id, staff_headers, guardian_headers, student, fee_invoice_id


def test_checkout_creates_a_pending_payment_for_the_outstanding_amount():
    _slug, _tenant_id, _staff, guardian_headers, student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()
    fees_before = client.get(f"/api/v1/guardian-portal/children/{student['id']}/fees", headers=guardian_headers).json()
    outstanding = Decimal(fees_before[0]["outstanding"])
    assert outstanding > 0

    resp = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_sandbox"] is True
    assert body["amount"] == int(outstanding * 100)  # paise, the real outstanding total -- not the original invoice total
    assert body["payment"]["status"] == "pending"
    assert body["order_id"].startswith("SANDBOX_order_")


def test_checkout_rejects_a_student_not_owned_by_the_guardian():
    _slug, _tenant_id, staff_headers, guardian_headers, _student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()
    branch_id = client.get("/api/v1/branches", headers=staff_headers).json()[0]["id"]
    other_student = client.post(
        "/api/v1/students", headers=staff_headers, json={"branch_id": branch_id, "first_name": "Other", "last_name": "Kid", "admission_date": "2026-06-01"},
    ).json()

    resp = client.post(f"/api/v1/guardian-portal/children/{other_student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers)
    assert resp.status_code == 404, resp.text


def test_simulating_success_creates_a_real_receipt_and_clears_outstanding():
    _slug, _tenant_id, staff_headers, guardian_headers, student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()

    checkout = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers).json()
    payment_id = checkout["payment"]["id"]

    sim = client.post(f"/api/v1/guardian-portal/fee-payments/{payment_id}/simulate", headers=guardian_headers, json={"succeed": True})
    assert sim.status_code == 200, sim.text
    assert sim.json()["status"] == "succeeded"

    fees = client.get(f"/api/v1/guardian-portal/children/{student['id']}/fees", headers=guardian_headers).json()
    assert Decimal(fees[0]["outstanding"]) == Decimal("0")

    receipts = client.get("/api/v1/receipts", headers=staff_headers).json()
    assert len(receipts) == 1
    assert Decimal(receipts[0]["amount"]) == Decimal(checkout["amount"]) / 100


def test_simulating_failure_marks_failed_and_leaves_outstanding_unchanged():
    _slug, _tenant_id, _staff, guardian_headers, student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()

    checkout = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers).json()
    payment_id = checkout["payment"]["id"]

    sim = client.post(f"/api/v1/guardian-portal/fee-payments/{payment_id}/simulate", headers=guardian_headers, json={"succeed": False})
    assert sim.status_code == 200, sim.text
    assert sim.json()["status"] == "failed"
    assert sim.json()["failure_reason"]

    fees = client.get(f"/api/v1/guardian-portal/children/{student['id']}/fees", headers=guardian_headers).json()
    assert Decimal(fees[0]["outstanding"]) == Decimal(fees[0]["total"])


def test_paying_an_already_fully_paid_invoice_is_rejected():
    _slug, _tenant_id, staff_headers, guardian_headers, student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()
    checkout = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers).json()
    client.post(f"/api/v1/guardian-portal/fee-payments/{checkout['payment']['id']}/simulate", headers=guardian_headers, json={"succeed": True})

    resp = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers)
    assert resp.status_code == 400, resp.text


def test_webhook_rejects_invalid_signature():
    resp = client.post("/api/v1/fee-payments/webhooks", content=b"{}", headers={"X-Webhook-Signature": "not-a-real-signature", "Content-Type": "application/json"})
    assert resp.status_code == 401, resp.text


def test_direct_webhook_call_with_valid_signature_is_idempotent():
    """Hits /fee-payments/webhooks itself, not the guardian-portal
    simulate helper -- the real path a gateway's own callback would
    take, signed with the sandbox provider's own dev secret (same
    convention test_billing_flow.py already established for
    /billing/webhooks)."""
    _slug, tenant_id, staff_headers, guardian_headers, student, fee_invoice_id = _setup_tenant_with_invoice_and_portal()
    checkout = client.post(f"/api/v1/guardian-portal/children/{student['id']}/fees/{fee_invoice_id}/checkout", headers=guardian_headers).json()

    payload = json.dumps({
        "event": "payment.success", "tenant_id": tenant_id, "order_id": checkout["order_id"],
        "payment_id": "SANDBOX_pay_directcall", "method": "upi",
    }).encode()
    signature = SandboxPaymentProvider().sign(payload)

    first = client.post("/api/v1/fee-payments/webhooks", content=payload, headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"})
    assert first.status_code == 200, first.text

    replay = client.post("/api/v1/fee-payments/webhooks", content=payload, headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"})
    assert replay.status_code == 200, replay.text

    receipts = client.get("/api/v1/receipts", headers=staff_headers).json()
    assert len(receipts) == 1  # the replay did not create a second receipt
