"""Homework & Assignments (spec sec15): homework assigned per
section+subject, and staff-marked submission tracking (no student
portal exists yet, so the roster-based bulk mark IS the real
workflow) -- exercised through the real HTTP API.
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


def _setup_tenant(n_students=3):
    slug = f"hw-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 5", "sequence": 5}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Science", "code": "SCI"}).json()

    students = []
    for i in range(n_students):
        student = client.post(
            "/api/v1/students", headers=headers,
            json={
                "branch_id": branch_id, "first_name": f"Student{i}", "last_name": "Test", "admission_date": "2026-06-01",
                "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": str(i + 1),
            },
        ).json()
        students.append(student)

    homework = client.post(
        "/api/v1/homework", headers=headers,
        json={"section_id": section["id"], "subject_id": subject["id"], "title": "Chapter 3 exercises", "assigned_date": "2026-07-01", "due_date": "2026-07-05"},
    ).json()

    return headers, section, subject, students, homework


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-hw-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/homework", headers=headers)
    assert resp.status_code == 403, resp.text


def test_due_date_before_assigned_date_is_rejected():
    slug = f"hwbad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    year = client.post("/api/v1/academic-years", headers=headers, json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True}).json()
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 5", "sequence": 5}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Science", "code": "SCI"}).json()

    resp = client.post(
        "/api/v1/homework", headers=headers,
        json={"section_id": section["id"], "subject_id": subject["id"], "title": "X", "assigned_date": "2026-07-05", "due_date": "2026-07-01"},
    )
    assert resp.status_code == 400, resp.text


def test_roster_reflects_real_enrolment_and_starts_pending():
    headers, _section, _subject, students, homework = _setup_tenant(3)

    roster = client.get(f"/api/v1/homework/{homework['id']}/roster", headers=headers).json()
    assert len(roster) == 3
    assert {r["status"] for r in roster} == {"pending"}
    assert {s["id"] for s in students} == {r["student_id"] for r in roster}


def test_bulk_submissions_then_roster_and_student_view_reflect_them():
    headers, _section, _subject, students, homework = _setup_tenant(3)

    resp = client.post(
        f"/api/v1/homework/{homework['id']}/submissions/bulk", headers=headers,
        json={"records": [
            {"student_id": students[0]["id"], "status": "submitted"},
            {"student_id": students[1]["id"], "status": "late", "remarks": "Submitted a day late"},
            {"student_id": students[2]["id"], "status": "missing"},
        ]},
    )
    assert resp.status_code == 200, resp.text
    by_id = {r["student_id"]: r for r in resp.json()}
    assert by_id[students[0]["id"]]["status"] == "submitted"
    assert by_id[students[0]["id"]]["submitted_date"] is not None
    assert by_id[students[1]["id"]]["status"] == "late"
    assert by_id[students[2]["id"]]["status"] == "missing"
    assert by_id[students[2]["id"]]["submitted_date"] is None

    student_view = client.get(f"/api/v1/students/{students[0]['id']}/homework", headers=headers).json()
    assert len(student_view) == 1
    assert student_view[0]["status"] == "submitted"
    assert student_view[0]["homework"]["title"] == "Chapter 3 exercises"


def test_re_marking_the_same_student_updates_in_place_not_duplicates():
    headers, _section, _subject, students, homework = _setup_tenant(1)

    client.post(f"/api/v1/homework/{homework['id']}/submissions/bulk", headers=headers, json={"records": [{"student_id": students[0]["id"], "status": "missing"}]})
    client.post(f"/api/v1/homework/{homework['id']}/submissions/bulk", headers=headers, json={"records": [{"student_id": students[0]["id"], "status": "submitted"}]})

    roster = client.get(f"/api/v1/homework/{homework['id']}/roster", headers=headers).json()
    assert len(roster) == 1
    assert roster[0]["status"] == "submitted"
