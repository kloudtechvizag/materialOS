"""Integrations (Phase 7): education-domain business events wired into
the platform's existing webhook system (services/webhooks.py, ADR-013's
retry/dead-letter shape) -- no new tables, no new API, no new frontend,
since WebhooksPage.tsx already renders whatever REAL_EVENTS lists. Push
based (the school configures its own destination URL), so it needs no
external credentials on our side, unlike every other integration this
vertical has deliberately deferred.
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
            "industry_slug": "school_education",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_education_events_are_in_the_real_catalog():
    slug = f"whev-cat-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    events = {e["event_type"] for e in client.get("/api/v1/webhooks/events", headers=headers).json()}
    assert {"student.enrolled", "fee_invoice.generated", "examination.results_published", "admission.enquiry.created"} <= events


def test_education_actions_emit_real_webhook_deliveries():
    slug = f"whev-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]

    sub = client.post(
        "/api/v1/webhook-subscriptions", headers=headers,
        json={
            "url": "https://example.com/hook",
            "event_types": ["student.enrolled", "fee_invoice.generated", "examination.results_published", "admission.enquiry.created"],
        },
    ).json()

    # admission.enquiry.created
    client.post("/api/v1/admission-enquiries", headers=headers, json={"student_name": "Lead Kid", "guardian_name": "Lead Parent", "source": "Website"})

    # student.enrolled (+ everything fee_invoice.generated needs)
    year = client.post("/api/v1/academic-years", headers=headers, json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True}).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Class A", "sequence": 1}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=headers,
        json={"first_name": "Web", "last_name": "Hook", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()

    # fee_invoice.generated
    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Parent Of Web"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})
    fee_head = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Tuition", "code": "TUITION"}).json()
    structure = client.post("/api/v1/fee-structure-items", headers=headers, json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "1000", "due_date": "2026-10-15"}).json()
    client.post("/api/v1/fee-invoices/generate", headers=headers, json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure["id"]]})

    # examination.results_published -- only on the lock transition, not on creation
    exam = client.post("/api/v1/examinations", headers=headers, json={"academic_year_id": year["id"], "name": "Term 1", "start_date": "2026-09-25", "end_date": "2026-09-26"}).json()
    lock_resp = client.post(f"/api/v1/examinations/{exam['id']}/lock", headers=headers)
    assert lock_resp.status_code == 200, lock_resp.text

    deliveries = client.get(f"/api/v1/webhook-subscriptions/{sub['id']}/deliveries", headers=headers).json()
    fired = {d["event_type"] for d in deliveries}
    assert fired == {"student.enrolled", "fee_invoice.generated", "examination.results_published", "admission.enquiry.created"}
    assert all(d["status"] == "pending" for d in deliveries)  # queued, not actually delivered in tests (no worker running)


def test_examination_relock_does_not_double_fire():
    slug = f"whev-relock-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    sub = client.post("/api/v1/webhook-subscriptions", headers=headers, json={"url": "https://example.com/hook", "event_types": ["examination.results_published"]}).json()

    year = client.post("/api/v1/academic-years", headers=headers, json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True}).json()
    exam = client.post("/api/v1/examinations", headers=headers, json={"academic_year_id": year["id"], "name": "Term 1", "start_date": "2026-09-25", "end_date": "2026-09-26"}).json()

    client.post(f"/api/v1/examinations/{exam['id']}/lock", headers=headers)
    client.post(f"/api/v1/examinations/{exam['id']}/lock", headers=headers)  # redundant re-lock, not a real unlocked->locked transition

    deliveries = client.get(f"/api/v1/webhook-subscriptions/{sub['id']}/deliveries", headers=headers).json()
    assert len(deliveries) == 1
