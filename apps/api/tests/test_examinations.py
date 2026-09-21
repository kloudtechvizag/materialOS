"""Examinations & Report Cards (spec sec13/14): per-class-per-subject
exam schedules, bulk marks entry, the exam-lock workflow, and a
computed report card -- exercised through the real HTTP API.
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
    slug = f"exam-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 7", "sequence": 7}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Science", "code": "SCI"}).json()

    students = []
    for i in range(n_students):
        student = client.post(
            "/api/v1/students", headers=headers,
            json={
                "first_name": f"Student{i}", "last_name": "Test", "admission_date": "2026-06-01",
                "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": str(i + 1),
            },
        ).json()
        students.append(student)

    exam = client.post(
        "/api/v1/examinations", headers=headers,
        json={"academic_year_id": year["id"], "name": "Mid Term 1", "start_date": "2026-09-01", "end_date": "2026-09-10"},
    ).json()
    schedule = client.post(
        f"/api/v1/examinations/{exam['id']}/subjects", headers=headers,
        json={"school_class_id": school_class["id"], "subject_id": subject["id"], "max_marks": "100", "pass_marks": "33"},
    ).json()

    return headers, year, school_class, section, subject, students, exam, schedule


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-exam-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/examinations", headers=headers)
    assert resp.status_code == 403, resp.text


def test_roster_reflects_real_enrolment_and_starts_unmarked():
    headers, _year, _cls, section, _subject, students, _exam, schedule = _setup_tenant(3)

    roster = client.get(f"/api/v1/examinations/subjects/{schedule['id']}/roster", headers=headers, params={"section_id": section["id"]}).json()
    assert len(roster) == 3
    assert {r["marks_obtained"] for r in roster} == {None}
    assert {s["id"] for s in students} == {r["student_id"] for r in roster}


def test_bulk_marks_then_roster_and_report_card_reflect_them():
    headers, _year, _cls, section, _subject, students, exam, schedule = _setup_tenant(3)

    mark = client.post(
        f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers,
        json={"records": [
            {"student_id": students[0]["id"], "marks_obtained": "85"},
            {"student_id": students[1]["id"], "marks_obtained": "20"},
            {"student_id": students[2]["id"], "is_absent": True},
        ]},
    )
    assert mark.status_code == 200, mark.text

    roster = client.get(f"/api/v1/examinations/subjects/{schedule['id']}/roster", headers=headers, params={"section_id": section["id"]}).json()
    by_id = {r["student_id"]: r for r in roster}
    assert by_id[students[0]["id"]]["marks_obtained"] == "85.00"
    assert by_id[students[1]["id"]]["marks_obtained"] == "20.00"
    assert by_id[students[2]["id"]]["is_absent"] is True

    card0 = client.get(f"/api/v1/examinations/{exam['id']}/report-card/{students[0]['id']}", headers=headers).json()
    assert card0["overall_result"] == "pass"
    assert card0["percentage"] == "85.00"
    assert card0["subjects"][0]["grade"] == "A"

    card1 = client.get(f"/api/v1/examinations/{exam['id']}/report-card/{students[1]['id']}", headers=headers).json()
    assert card1["overall_result"] == "fail"

    card2 = client.get(f"/api/v1/examinations/{exam['id']}/report-card/{students[2]['id']}", headers=headers).json()
    assert card2["overall_result"] == "fail"
    assert card2["subjects"][0]["is_absent"] is True
    # Regression: Decimal(0) / Decimal("100.00") carries the divisor's
    # exponent and renders as "0E+2" unless explicitly quantized.
    assert card2["percentage"] == "0.00"


def test_report_card_is_incomplete_until_every_scheduled_subject_is_marked():
    headers, year, school_class, _section, _subject, students, exam, schedule = _setup_tenant(1)

    second_subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Maths", "code": "MAT"}).json()
    client.post(
        f"/api/v1/examinations/{exam['id']}/subjects", headers=headers,
        json={"school_class_id": school_class["id"], "subject_id": second_subject["id"], "max_marks": "100", "pass_marks": "33"},
    )

    client.post(
        f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers,
        json={"records": [{"student_id": students[0]["id"], "marks_obtained": "90"}]},
    )

    card = client.get(f"/api/v1/examinations/{exam['id']}/report-card/{students[0]['id']}", headers=headers).json()
    assert card["overall_result"] == "incomplete"
    assert card["overall_grade"] is None


def test_marks_cannot_exceed_max_marks():
    headers, _year, _cls, _section, _subject, students, _exam, schedule = _setup_tenant(1)

    resp = client.post(
        f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers,
        json={"records": [{"student_id": students[0]["id"], "marks_obtained": "150"}]},
    )
    assert resp.status_code == 400, resp.text


def test_locking_an_examination_blocks_further_marks_entry():
    headers, _year, _cls, _section, _subject, students, exam, schedule = _setup_tenant(1)

    lock = client.post(f"/api/v1/examinations/{exam['id']}/lock", headers=headers)
    assert lock.status_code == 200, lock.text
    assert lock.json()["is_locked"] is True

    blocked = client.post(
        f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers,
        json={"records": [{"student_id": students[0]["id"], "marks_obtained": "50"}]},
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["error"]["code"] == "PERIOD_LOCKED"

    unlock = client.post(f"/api/v1/examinations/{exam['id']}/unlock", headers=headers)
    assert unlock.status_code == 200
    assert unlock.json()["is_locked"] is False

    allowed = client.post(
        f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers,
        json={"records": [{"student_id": students[0]["id"], "marks_obtained": "50"}]},
    )
    assert allowed.status_code == 200, allowed.text
