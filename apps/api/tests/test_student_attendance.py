"""Student attendance (spec sec11): daily attendance marked against a
real Student + Section, exercised through the real HTTP API. Deliberately
separate from employee attendance (test_hr_payroll.py's own domain).
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


def _setup_class_with_students(n=3):
    slug = f"satt-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 4", "sequence": 4}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()

    students = []
    for i in range(n):
        student = client.post(
            "/api/v1/students", headers=headers,
            json={
                "branch_id": branch_id, "first_name": f"Student{i}", "last_name": "Test", "admission_date": "2026-06-01",
                "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": str(i + 1),
            },
        ).json()
        students.append(student)

    return headers, section, students


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-satt-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/student-attendance/roster", headers=headers, params={"section_id": str(uuid.uuid4()), "attendance_date": "2026-06-01"})
    assert resp.status_code == 403, resp.text


def test_roster_reflects_real_enrolment_and_starts_unmarked():
    headers, section, students = _setup_class_with_students(3)

    resp = client.get("/api/v1/student-attendance/roster", headers=headers, params={"section_id": section["id"], "attendance_date": "2026-07-01"})
    assert resp.status_code == 200, resp.text
    roster = resp.json()
    assert len(roster) == 3
    assert {r["status"] for r in roster} == {None}
    assert {r["roll_number"] for r in roster} == {"1", "2", "3"}
    assert {s["id"] for s in students} == {r["student_id"] for r in roster}


def test_bulk_mark_then_roster_reflects_the_marks():
    headers, section, students = _setup_class_with_students(3)

    mark = client.post(
        "/api/v1/student-attendance/bulk", headers=headers,
        json={
            "section_id": section["id"], "attendance_date": "2026-07-01",
            "records": [
                {"student_id": students[0]["id"], "status": "present"},
                {"student_id": students[1]["id"], "status": "absent", "remarks": "Fever"},
                {"student_id": students[2]["id"], "status": "late"},
            ],
        },
    )
    assert mark.status_code == 200, mark.text
    assert len(mark.json()) == 3

    roster = client.get("/api/v1/student-attendance/roster", headers=headers, params={"section_id": section["id"], "attendance_date": "2026-07-01"}).json()
    by_id = {r["student_id"]: r["status"] for r in roster}
    assert by_id[students[0]["id"]] == "present"
    assert by_id[students[1]["id"]] == "absent"
    assert by_id[students[2]["id"]] == "late"

    history = client.get("/api/v1/student-attendance", headers=headers, params={"student_id": students[1]["id"]}).json()
    assert len(history) == 1
    assert history[0]["status"] == "absent"
    assert history[0]["remarks"] == "Fever"


def test_re_marking_the_same_date_updates_in_place_not_duplicates():
    headers, section, students = _setup_class_with_students(1)

    client.post(
        "/api/v1/student-attendance/bulk", headers=headers,
        json={"section_id": section["id"], "attendance_date": "2026-07-01", "records": [{"student_id": students[0]["id"], "status": "absent"}]},
    )
    client.post(
        "/api/v1/student-attendance/bulk", headers=headers,
        json={"section_id": section["id"], "attendance_date": "2026-07-01", "records": [{"student_id": students[0]["id"], "status": "present"}]},
    )

    history = client.get("/api/v1/student-attendance", headers=headers, params={"student_id": students[0]["id"]}).json()
    assert len(history) == 1
    assert history[0]["status"] == "present"
