"""Admissions CRM (spec sec7): Enquiry -> Application -> Decision ->
real Student + Enrolment, exercised through the real HTTP API. The
critical assertion is the same "connected lifecycle" one as ADR-025's
own SIS tests: converting an application creates a genuine Student
with a real enrolment, not a stub.
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


def _setup_school():
    slug = f"adm-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 3", "sequence": 3}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    return headers, year, school_class, section


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-adm-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/admission-enquiries", headers=headers)
    assert resp.status_code == 403, resp.text


def test_enquiry_to_application_conversion_marks_enquiry_converted():
    headers, year, school_class, _section = _setup_school()

    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Aarav Shah", "desired_grade": "Grade 3", "guardian_name": "Mr. Shah", "guardian_phone": "9000000001", "source": "Website"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry = enquiry.json()
    assert enquiry["status"] == "open"

    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={
            "branch_id": school_class["branch_id"], "enquiry_id": enquiry["id"], "first_name": "Aarav", "last_name": "Shah", "desired_grade": "Grade 3",
            "academic_year_id": year["id"], "guardian_name": "Mr. Shah", "guardian_phone": "9000000001",
        },
    )
    assert application.status_code == 201, application.text
    assert application.json()["status"] == "submitted"

    refetched_enquiry = client.get("/api/v1/admission-enquiries", headers=headers).json()[0]
    assert refetched_enquiry["status"] == "converted"


def test_application_status_transitions_and_terminal_lock():
    headers, year, school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "first_name": "Diya", "last_name": "Nair", "academic_year_id": year["id"], "guardian_name": "Mrs. Nair"},
    ).json()

    resp = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "under_review"})
    assert resp.status_code == 200, resp.text
    resp = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "interview_scheduled", "interview_date": "2026-07-01"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["interview_date"] == "2026-07-01"

    rejected = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "rejected", "decision_reason": "Seats full"})
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["decided_at"] is not None

    # Terminal -- no further transitions accepted.
    blocked = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "under_review"})
    assert blocked.status_code == 400, blocked.text


def test_admitted_status_cannot_be_set_via_plain_patch():
    headers, year, school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "first_name": "Kabir", "last_name": "Joshi", "academic_year_id": year["id"], "guardian_name": "Mr. Joshi"},
    ).json()

    resp = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "admitted"})
    assert resp.status_code == 400, resp.text


def test_converting_an_application_creates_a_real_student_and_enrolment():
    headers, year, school_class, section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "first_name": "Meher", "last_name": "Kapoor", "academic_year_id": year["id"], "guardian_name": "Mrs. Kapoor"},
    ).json()

    convert = client.post(
        f"/api/v1/admission-applications/{application['id']}/convert", headers=headers,
        json={"school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "9"},
    )
    assert convert.status_code == 201, convert.text
    student = convert.json()
    assert student["first_name"] == "Meher"
    assert student["admission_number"] == "STU-0001"

    # The application now carries the real student_id, status flipped
    # to admitted -- and this is the ONLY way it could have gotten there.
    refetched = client.get(f"/api/v1/admission-applications/{application['id']}", headers=headers).json()
    assert refetched["status"] == "admitted"
    assert refetched["student_id"] == student["id"]

    enrolments = client.get(f"/api/v1/students/{student['id']}/enrolments", headers=headers).json()
    assert len(enrolments) == 1
    assert enrolments[0]["school_class_id"] == school_class["id"]
    assert enrolments[0]["section_id"] == section["id"]
    assert enrolments[0]["roll_number"] == "9"

    # A student now genuinely exists in the directory, not a stub.
    students = client.get("/api/v1/students", headers=headers).json()
    assert len(students) == 1


def test_enquiry_created_and_status_change_activities_are_logged_automatically():
    headers, _year, school_class, _section = _setup_school()
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Ira Bose", "guardian_name": "Mr. Bose", "source": "Referral"},
    ).json()

    activities = client.get(f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers).json()
    assert len(activities) == 1
    assert activities[0]["activity_type"] == "created"

    resp = client.patch(f"/api/v1/admission-enquiries/{enquiry['id']}", headers=headers, json={"status": "contacted"})
    assert resp.status_code == 200, resp.text

    activities = client.get(f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers).json()
    assert len(activities) == 2
    status_change = next(a for a in activities if a["activity_type"] == "status_change")
    assert "contacted" in status_change["description"].lower()

    # PATCHing an unchanged status must not fabricate a second entry.
    client.patch(f"/api/v1/admission-enquiries/{enquiry['id']}", headers=headers, json={"status": "contacted"})
    assert len(client.get(f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers).json()) == 2


def test_staff_can_log_a_note_and_a_call_on_an_enquiry():
    headers, _year, school_class, _section = _setup_school()
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Vihaan Rao", "guardian_name": "Mrs. Rao"},
    ).json()

    note = client.post(
        f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers,
        json={"activity_type": "note", "description": "Family visited campus, liked the science lab."},
    )
    assert note.status_code == 201, note.text
    assert note.json()["created_by_name"]

    call = client.post(
        f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers,
        json={"activity_type": "call", "description": "Called guardian, will decide by Friday."},
    )
    assert call.status_code == 201, call.text

    invalid = client.post(
        f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers,
        json={"activity_type": "not_a_real_type", "description": "x"},
    )
    assert invalid.status_code == 400, invalid.text

    activities = client.get(f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers).json()
    assert len(activities) == 3  # created + note + call


def test_assigning_a_counsellor_reuses_the_real_employee_directory():
    headers, _year, school_class, _section = _setup_school()
    employee = client.post(
        "/api/v1/employees", headers=headers,
        json={"branch_id": school_class["branch_id"], "first_name": "Asha", "last_name": "Rao", "joining_date": "2026-01-01", "employment_type": "full_time"},
    ).json()

    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Kiaan Verma", "guardian_name": "Mr. Verma", "assigned_to_id": employee["id"]},
    ).json()
    assert enquiry["assigned_to_id"] == employee["id"]
    assert enquiry["assigned_to_name"] == "Asha Rao"


def test_duplicate_enquiry_detection_ignores_closed_and_converted_leads():
    headers, year, school_class, _section = _setup_school()
    first = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Reyansh Iyer", "guardian_name": "Mr. Iyer", "guardian_phone": "9000000099"},
    ).json()

    dupes = client.get(
        "/api/v1/admission-enquiries/duplicates", headers=headers,
        params={"student_name": "Reyansh Iyer", "guardian_phone": "9000000099"},
    ).json()
    assert len(dupes) == 1
    assert dupes[0]["id"] == first["id"]

    client.patch(f"/api/v1/admission-enquiries/{first['id']}", headers=headers, json={"status": "closed"})
    dupes_after_close = client.get(
        "/api/v1/admission-enquiries/duplicates", headers=headers,
        params={"student_name": "Reyansh Iyer", "guardian_phone": "9000000099"},
    ).json()
    assert dupes_after_close == []


def test_converted_status_cannot_be_set_via_plain_enquiry_patch():
    headers, _year, school_class, _section = _setup_school()
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Advika Pillai", "guardian_name": "Mrs. Pillai"},
    ).json()
    resp = client.patch(f"/api/v1/admission-enquiries/{enquiry['id']}", headers=headers, json={"status": "converted"})
    assert resp.status_code == 400, resp.text


def test_converting_via_application_logs_a_real_status_change_activity():
    headers, year, school_class, _section = _setup_school()
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Ishaan Chatterjee", "guardian_name": "Mr. Chatterjee"},
    ).json()
    client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "enquiry_id": enquiry["id"], "first_name": "Ishaan", "last_name": "Chatterjee", "academic_year_id": year["id"], "guardian_name": "Mr. Chatterjee"},
    )
    activities = client.get(f"/api/v1/admission-enquiries/{enquiry['id']}/activities", headers=headers).json()
    status_change = next(a for a in activities if a["activity_type"] == "status_change")
    assert "converted" in status_change["description"].lower()


def test_admissions_summary_reflects_real_counts_and_derived_application_started():
    headers, year, school_class, _section = _setup_school()
    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"branch_id": school_class["branch_id"], "student_name": "Myra Sen", "guardian_name": "Mrs. Sen"},
    ).json()

    summary = client.get("/api/v1/admission-enquiries/summary", headers=headers).json()
    assert summary["total_enquiries"] == 1
    assert summary["applications_started"] == 0
    assert summary["pipeline"]["open"] == 1

    client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "enquiry_id": enquiry["id"], "first_name": "Myra", "last_name": "Sen", "academic_year_id": year["id"], "guardian_name": "Mrs. Sen"},
    )

    summary = client.get("/api/v1/admission-enquiries/summary", headers=headers).json()
    assert summary["applications_started"] == 1
    assert summary["pipeline"]["application_started"] == 1

    enquiry_after = client.get(f"/api/v1/admission-enquiries/{enquiry['id']}", headers=headers).json()
    assert enquiry_after["has_application"] is True


def test_a_converted_application_cannot_be_converted_again():
    headers, year, school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"branch_id": school_class["branch_id"], "first_name": "Zara", "last_name": "Khan", "academic_year_id": year["id"], "guardian_name": "Mrs. Khan"},
    ).json()

    first = client.post(f"/api/v1/admission-applications/{application['id']}/convert", headers=headers, json={"school_class_id": school_class["id"]})
    assert first.status_code == 201, first.text

    second = client.post(f"/api/v1/admission-applications/{application['id']}/convert", headers=headers, json={"school_class_id": school_class["id"]})
    assert second.status_code == 400, second.text
