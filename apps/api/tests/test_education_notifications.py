"""ADR-043: education reuses the platform's existing notification-rule
engine (services/notification_rules.py, ADR-013/014/015) rather than a
parallel guardian-notification mechanism -- fee invoice generation and
announcement publishing each fire a real, table-driven trigger. Exercised
through the real HTTP API.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _signed_up_token(slug: str, industry_slug: str = "school_education") -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
            "industry_slug": industry_slug,
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def test_education_trigger_types_are_seeded_at_signup():
    slug = f"ednotif-seed-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    rules = client.get("/api/v1/notifications/rules", headers=headers).json()
    trigger_types = {r["trigger_type"] for r in rules}
    assert {"fee_invoice_generated", "announcement_published"} <= trigger_types
    # Conservative default, same as every other rule here -- in_app
    # only until a tenant opts email in themselves.
    fee_rule = next(r for r in rules if r["trigger_type"] == "fee_invoice_generated")
    assert fee_rule["channels"] == ["in_app"]


def test_generating_a_fee_invoice_fires_a_real_notification():
    slug = f"ednotif-fee-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]

    year = client.post("/api/v1/academic-years", headers=headers, json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True}).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 3", "sequence": 3}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=headers,
        json={"branch_id": branch_id, "first_name": "Nina", "last_name": "Test", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()
    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Parent of Nina", "email": "parent-nina@example.com"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})

    fee_head = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Tuition", "code": "TUITION"}).json()
    structure = client.post(
        "/api/v1/fee-structure-items", headers=headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "1000", "due_date": "2026-10-15"},
    ).json()
    gen = client.post("/api/v1/fee-invoices/generate", headers=headers, json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure["id"]]}).json()
    fee_invoice_id = gen["created"][0]["id"]

    notifications = client.get("/api/v1/notifications", headers=headers).json()
    matches = [n for n in notifications if n["notification_type"] == "fee_invoice_generated" and n["entity_id"] == fee_invoice_id]
    assert len(matches) == 1
    assert "Nina" in matches[0]["message"]


def test_publishing_an_announcement_fires_one_notification_per_guardian_in_scope():
    slug = f"ednotif-ann-{uuid.uuid4().hex[:8]}"
    headers = {"Authorization": f"Bearer {_signed_up_token(slug)}"}
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]

    year = client.post("/api/v1/academic-years", headers=headers, json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True}).json()

    def make_family(class_name, first_name):
        school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": class_name, "sequence": 1}).json()
        section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
        student = client.post(
            "/api/v1/students", headers=headers,
            json={"branch_id": branch_id, "first_name": first_name, "last_name": "Test", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
        ).json()
        guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": f"Parent of {first_name}", "email": f"{first_name.lower()}@example.com"}).json()
        client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})
        return school_class

    class_a = make_family("Grade 1", "AliceKid")
    make_family("Grade 2", "BobKid")  # different class -- out of scope for a class-targeted announcement to class_a

    resp = client.post(
        "/api/v1/announcements", headers=headers,
        json={"title": "Sports Day", "body": "Grade 1 sports day on Friday.", "target_type": "class", "target_school_class_id": class_a["id"], "target_section_id": None, "expires_at": None},
    )
    assert resp.status_code == 201, resp.text
    announcement_id = resp.json()["id"]

    notifications = client.get("/api/v1/notifications", headers=headers).json()
    matches = [n for n in notifications if n["notification_type"] == "announcement_published" and n["entity_id"] == announcement_id]
    assert len(matches) == 1  # only Alice's guardian, not Bob's
