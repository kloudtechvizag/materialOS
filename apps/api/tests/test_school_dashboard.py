"""School Dashboard (ADR-046): every KPI/needs-attention/today's-
schedule entry is computed on read from real tables, exercised through
the real HTTP API with hand-picked data. Permission gating is the
other half of this endpoint's contract -- a user holding only a
subset of the real per-resource permissions must see exactly that
subset reflected as populated-vs-null sections, never everything and
never a 403 for the page as a whole.
"""
import uuid
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import set_session_context
from app.main import app
from app.models.attendance import AttendanceRecord
from app.models.user import Permission, Role, RolePermission, User, UserRole
from app.security import create_access_token, decode_token

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


def _raw_session(tenant_id: uuid.UUID):
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    set_session_context(session, tenant_id=str(tenant_id), user_id=None)
    return session


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-sd-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/school-dashboard/summary", headers=headers)
    assert resp.status_code == 403, resp.text


def test_summary_is_honest_when_nothing_exists_yet():
    slug = f"sd-empty-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/school-dashboard/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["kpis"]["total_active_students"] == 0
    assert body["needs_attention"] == []
    assert body["today_schedule"] == []


def test_summary_reflects_real_hand_picked_data_across_domains():
    slug = f"sd-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    payload = decode_token(token)
    tenant_id = uuid.UUID(payload["tenant_id"])
    owner_user_id = uuid.UUID(payload["sub"])

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 4", "sequence": 4}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Math", "code": "MATH"}).json()

    student = client.post(
        "/api/v1/students", headers=headers,
        json={"branch_id": branch_id, "first_name": "Ira", "last_name": "Nair", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()
    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Parent of Ira"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})

    # Fees: one invoice, due last week, fully unpaid -> overdue.
    fee_head = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Tuition", "code": "TUITION"}).json()
    past_due = date.today() - timedelta(days=7)
    structure = client.post(
        "/api/v1/fee-structure-items", headers=headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "fee_head_id": fee_head["id"], "amount": "1000", "due_date": str(past_due)},
    ).json()
    client.post("/api/v1/fee-invoices/generate", headers=headers, json={"school_class_id": school_class["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure["id"]]})

    # Homework: due yesterday, still pending -> overdue and unmarked.
    hw = client.post(
        "/api/v1/homework", headers=headers,
        json={"section_id": section["id"], "subject_id": subject["id"], "title": "HW1", "assigned_date": str(date.today() - timedelta(days=3)), "due_date": str(date.today() - timedelta(days=1))},
    ).json()
    client.post(f"/api/v1/homework/{hw['id']}/submissions/bulk", headers=headers, json={"records": [{"student_id": student["id"], "status": "pending"}]})

    # An enquiry with a real application -> pending admissions + application-started.
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": branch_id, "student_name": "Kabir Rao", "guardian_name": "Mr. Rao"},
    ).json()
    client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": branch_id, "enquiry_id": enquiry["id"], "first_name": "Kabir", "last_name": "Rao", "academic_year_id": year["id"], "guardian_name": "Mr. Rao"},
    )

    # Timetable: one period today.
    slot = client.post("/api/v1/timetable-slots", headers=headers, json={"name": "Period 1", "sequence": 1, "start_time": "09:00:00", "end_time": "09:45:00", "is_break": False}).json()
    today_dow = date.today().weekday()
    client.put("/api/v1/timetable/entries", headers=headers, json={"section_id": section["id"], "day_of_week": today_dow, "slot_id": slot["id"], "subject_id": subject["id"]})

    # Staff: one employee present today, via a direct row insert -- no
    # admin "mark attendance for employee X on date Y" endpoint exists
    # (clock-in only ever targets the caller's own linked employee and
    # today), the same test-setup-only ORM pattern already established
    # for role/permission fixtures elsewhere in this suite.
    employee = client.post("/api/v1/employees", headers=headers, json={"branch_id": branch_id, "first_name": "Asha", "last_name": "Verma", "joining_date": "2026-06-01", "employment_type": "full_time"}).json()
    db = _raw_session(tenant_id)
    try:
        db.add(AttendanceRecord(tenant_id=tenant_id, employee_id=uuid.UUID(employee["id"]), attendance_date=date.today(), status="present"))
        db.commit()
    finally:
        db.close()

    resp = client.get("/api/v1/school-dashboard/summary", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["kpis"]["total_active_students"] == 1
    assert body["kpis"]["pending_admissions"] == 1
    assert body["kpis"]["new_enquiries_this_week"] == 1
    assert body["kpis"]["overdue_fee_accounts"] == 1
    assert body["kpis"]["staff_present_today"] == 1
    assert body["fees"]["overdue_accounts"] == 1
    assert body["academic"]["homework_pending"] == 1
    assert body["academic"]["classes_scheduled_today"] == 1
    assert body["admissions_pipeline"]["applications_started"] == 1
    assert body["today_schedule_total_classes"] == 1

    schedule_titles = [item["title"] for item in body["today_schedule"]]
    assert "Math" in schedule_titles

    attention_keys = {item["key"] for item in body["needs_attention"]}
    assert "fees_overdue" in attention_keys
    assert "homework_overdue" in attention_keys
    assert "admissions_pending_review" in attention_keys


def test_a_user_with_only_students_view_sees_only_that_section():
    slug = f"sd-perm-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    payload = decode_token(token)
    tenant_id = uuid.UUID(payload["tenant_id"])

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 5", "sequence": 5}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    client.post(
        "/api/v1/students", headers=headers,
        json={"branch_id": branch_id, "first_name": "Zoya", "last_name": "Khan", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    )

    db = _raw_session(tenant_id)
    try:
        role = Role(tenant_id=tenant_id, name="Students Only")
        db.add(role)
        db.flush()
        students_view = db.query(Permission).filter(Permission.code == "students.view").one()
        db.add(RolePermission(tenant_id=tenant_id, role_id=role.id, permission_id=students_view.id))
        limited_user = User(tenant_id=tenant_id, email="students-only@example.com", full_name="Students Only", hashed_password="x", is_active=True)
        db.add(limited_user)
        db.flush()
        db.add(UserRole(tenant_id=tenant_id, user_id=limited_user.id, role_id=role.id))
        db.commit()
        limited_user_id = limited_user.id
    finally:
        db.close()

    limited_token = create_access_token(user_id=limited_user_id, tenant_id=tenant_id)
    resp = client.get("/api/v1/school-dashboard/summary", headers={"Authorization": f"Bearer {limited_token}"})
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["kpis"]["total_active_students"] == 1
    assert body["kpis"]["new_enquiries_this_week"] is None
    assert body["kpis"]["fees_collected_this_month"] is None
    assert body["kpis"]["staff_present_today"] is None
    assert body["fees"] is None
    assert body["staff"] is None
    assert body["academic"] is None
    assert body["admissions_pipeline"] is None
    assert body["needs_attention"] == []
