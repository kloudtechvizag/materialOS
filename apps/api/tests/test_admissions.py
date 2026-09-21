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
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 3", "sequence": 3}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    return headers, year, school_class, section


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-adm-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/admission-enquiries", headers=headers)
    assert resp.status_code == 403, resp.text


def test_enquiry_to_application_conversion_marks_enquiry_converted():
    headers, year, _school_class, _section = _setup_school()

    enquiry = client.post(
        "/api/v1/admission-enquiries", headers=headers,
        json={"student_name": "Aarav Shah", "desired_grade": "Grade 3", "guardian_name": "Mr. Shah", "guardian_phone": "9000000001", "source": "Website"},
    )
    assert enquiry.status_code == 201, enquiry.text
    enquiry = enquiry.json()
    assert enquiry["status"] == "open"

    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={
            "enquiry_id": enquiry["id"], "first_name": "Aarav", "last_name": "Shah", "desired_grade": "Grade 3",
            "academic_year_id": year["id"], "guardian_name": "Mr. Shah", "guardian_phone": "9000000001",
        },
    )
    assert application.status_code == 201, application.text
    assert application.json()["status"] == "submitted"

    refetched_enquiry = client.get("/api/v1/admission-enquiries", headers=headers).json()[0]
    assert refetched_enquiry["status"] == "converted"


def test_application_status_transitions_and_terminal_lock():
    headers, year, _school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"first_name": "Diya", "last_name": "Nair", "academic_year_id": year["id"], "guardian_name": "Mrs. Nair"},
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
    headers, year, _school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"first_name": "Kabir", "last_name": "Joshi", "academic_year_id": year["id"], "guardian_name": "Mr. Joshi"},
    ).json()

    resp = client.patch(f"/api/v1/admission-applications/{application['id']}", headers=headers, json={"status": "admitted"})
    assert resp.status_code == 400, resp.text


def test_converting_an_application_creates_a_real_student_and_enrolment():
    headers, year, school_class, section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"first_name": "Meher", "last_name": "Kapoor", "academic_year_id": year["id"], "guardian_name": "Mrs. Kapoor"},
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


def test_a_converted_application_cannot_be_converted_again():
    headers, year, school_class, _section = _setup_school()
    application = client.post(
        "/api/v1/admission-applications", headers=headers,
        json={"first_name": "Zara", "last_name": "Khan", "academic_year_id": year["id"], "guardian_name": "Mrs. Khan"},
    ).json()

    first = client.post(f"/api/v1/admission-applications/{application['id']}/convert", headers=headers, json={"school_class_id": school_class["id"]})
    assert first.status_code == 201, first.text

    second = client.post(f"/api/v1/admission-applications/{application['id']}/convert", headers=headers, json={"school_class_id": school_class["id"]})
    assert second.status_code == 400, second.text
