"""Guardian (Parent) Portal (ADR-032): a guardian logs in with their
own restricted account and sees read-only rollups of just their own
children's real data -- modeled directly on the existing customer
portal (ADR-009). Exercised through the real HTTP API.
"""
import uuid
from decimal import Decimal

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


def _login(slug: str, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _setup_tenant_with_child_and_portal_login():
    slug = f"gp-{uuid.uuid4().hex[:8]}"
    staff_token = _signed_up_token(slug)
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    year = client.post(
        "/api/v1/academic-years", headers=staff_headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    branch_id = client.get("/api/v1/branches", headers=staff_headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=staff_headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 5", "sequence": 5}).json()
    section = client.post("/api/v1/sections", headers=staff_headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=staff_headers,
        json={
            "branch_id": branch_id, "first_name": "Aarav", "last_name": "Verma", "admission_date": "2026-06-01",
            "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1",
        },
    ).json()
    guardian = client.post("/api/v1/guardians", headers=staff_headers, json={"full_name": "Mrs. Verma", "phone": "9000000000"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=staff_headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})

    portal_access = client.post(
        f"/api/v1/guardians/{guardian['id']}/portal-access", headers=staff_headers,
        json={"email": f"guardian-{slug}@example.com", "password": "guardian-pass-123", "full_name": "Mrs. Verma"},
    )
    assert portal_access.status_code == 201, portal_access.text

    return slug, staff_headers, student, guardian, portal_access.json()


def test_module_gated_a_non_school_tenant_gets_403_on_portal_access():
    slug = f"nonschool-gp-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/guardian-portal/children", headers=headers)
    assert resp.status_code == 403, resp.text


def test_a_staff_login_is_rejected_from_the_guardian_portal():
    slug = f"gp2-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/guardian-portal/children", headers=headers)
    assert resp.status_code == 403, resp.text
    assert "guardian-portal" in resp.json()["error"]["message"]


def test_guardian_portal_login_lists_their_real_linked_child():
    slug, _staff_headers, student, _guardian, portal_access = _setup_tenant_with_child_and_portal_login()
    token = _login(slug, f"guardian-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert me["guardian_id"] == portal_access["guardian_id"]
    assert me["customer_id"] is None

    children = client.get("/api/v1/guardian-portal/children", headers=headers).json()
    assert len(children) == 1
    assert children[0]["student_id"] == student["id"]
    assert children[0]["relationship_type"] == "mother"


def test_guardian_sees_their_childs_real_attendance_and_homework():
    slug, staff_headers, student, _guardian, portal_access = _setup_tenant_with_child_and_portal_login()

    section_id = client.get("/api/v1/guardian-portal/children", headers={"Authorization": f"Bearer {_login(slug, f'guardian-{slug}@example.com', 'guardian-pass-123')}"}).json()[0]["section_id"]
    client.post(
        "/api/v1/student-attendance/bulk", headers=staff_headers,
        json={"section_id": section_id, "attendance_date": "2026-07-01", "records": [{"student_id": student["id"], "status": "present"}]},
    )
    subject = client.post("/api/v1/subjects", headers=staff_headers, json={"name": "Math", "code": "MATH"}).json()
    homework = client.post(
        "/api/v1/homework", headers=staff_headers,
        json={"section_id": section_id, "subject_id": subject["id"], "title": "Worksheet 1", "assigned_date": "2026-07-01", "due_date": "2026-07-05"},
    ).json()
    client.post(f"/api/v1/homework/{homework['id']}/submissions/bulk", headers=staff_headers, json={"records": [{"student_id": student["id"], "status": "submitted"}]})

    token = _login(slug, f"guardian-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}

    attendance = client.get(f"/api/v1/guardian-portal/children/{student['id']}/attendance", headers=headers).json()
    assert len(attendance) == 1
    assert attendance[0]["status"] == "present"

    homework_view = client.get(f"/api/v1/guardian-portal/children/{student['id']}/homework", headers=headers).json()
    assert len(homework_view) == 1
    assert homework_view[0]["status"] == "submitted"


def test_guardian_sees_their_childs_real_timetable_with_resolved_names():
    slug, staff_headers, student, _guardian, _portal_access = _setup_tenant_with_child_and_portal_login()

    children = client.get("/api/v1/guardian-portal/children", headers={"Authorization": f"Bearer {_login(slug, f'guardian-{slug}@example.com', 'guardian-pass-123')}"}).json()
    section_id = children[0]["section_id"]

    subject = client.post("/api/v1/subjects", headers=staff_headers, json={"name": "Science", "code": "SCI"}).json()
    slot = client.post("/api/v1/timetable-slots", headers=staff_headers, json={"name": "Period 1", "sequence": 1, "start_time": "09:00:00", "end_time": "09:45:00"}).json()
    client.put(
        "/api/v1/timetable/entries", headers=staff_headers,
        json={"section_id": section_id, "day_of_week": 0, "slot_id": slot["id"], "subject_id": subject["id"], "room": "12"},
    )

    token = _login(slug, f"guardian-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}
    timetable = client.get(f"/api/v1/guardian-portal/children/{student['id']}/timetable", headers=headers).json()
    assert len(timetable) == 1
    assert timetable[0]["subject_name"] == "Science"
    assert timetable[0]["slot_name"] == "Period 1"
    assert timetable[0]["room"] == "12"


def test_guardian_cannot_see_a_student_that_is_not_their_own_child():
    slug, staff_headers, _student, _guardian, portal_access = _setup_tenant_with_child_and_portal_login()

    year = client.get("/api/v1/academic-years", headers=staff_headers).json()[0]
    other_student = client.post(
        "/api/v1/students", headers=staff_headers,
        json={"branch_id": _student["branch_id"], "first_name": "Other", "last_name": "Kid", "admission_date": "2026-06-01", "academic_year_id": year["id"]},
    ).json()

    token = _login(slug, f"guardian-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"/api/v1/guardian-portal/children/{other_student['id']}/attendance", headers=headers)
    assert resp.status_code == 404, resp.text


def test_guardian_sees_their_childs_real_fee_invoice_and_outstanding():
    slug, staff_headers, student, _guardian, _portal_access = _setup_tenant_with_child_and_portal_login()

    year = client.get("/api/v1/academic-years", headers=staff_headers).json()[0]
    school_class = client.get("/api/v1/school-classes", headers=staff_headers, params={"academic_year_id": year["id"]}).json()[0]
    branch_id = client.get("/api/v1/branches", headers=staff_headers).json()[0]["id"]
    fee_head = client.post("/api/v1/fee-heads", headers=staff_headers, json={"name": "Tuition", "code": "TUITION"}).json()
    structure_item = client.post(
        "/api/v1/fee-structure-items", headers=staff_headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "4000", "due_date": "2026-07-15"},
    ).json()
    client.post(
        "/api/v1/fee-invoices/generate", headers=staff_headers,
        json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure_item["id"]]},
    )

    token = _login(slug, f"guardian-{slug}@example.com", "guardian-pass-123")
    headers = {"Authorization": f"Bearer {token}"}
    fees = client.get(f"/api/v1/guardian-portal/children/{student['id']}/fees", headers=headers).json()
    assert len(fees) == 1
    assert Decimal(fees[0]["outstanding"]) == Decimal("4000")
