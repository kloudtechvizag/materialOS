"""School Management (industry #26): the foundational Student
Information System -- academic years, classes, sections, students,
guardians, and enrolment, exercised through the real HTTP API. The
critical assertion (spec's own "connected student lifecycle") is that
a Student created with a class/section gets a real StudentEnrolment
row, not just a flat record.
"""
import uuid
from datetime import date

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
    slug = f"school-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year_resp = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    )
    assert year_resp.status_code == 201, year_resp.text
    year = year_resp.json()

    class_resp = client.post(
        "/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 5", "sequence": 5},
    )
    assert class_resp.status_code == 201, class_resp.text
    school_class = class_resp.json()

    section_resp = client.post(
        "/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A", "capacity": 40},
    )
    assert section_resp.status_code == 201, section_resp.text
    section = section_resp.json()

    return headers, year, school_class, section


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/students", headers=headers)
    assert resp.status_code == 403, resp.text


def test_academic_year_class_and_section_setup():
    headers, year, school_class, section = _setup_school()
    assert year["is_current"] is True
    assert school_class["academic_year_id"] == year["id"]
    assert section["school_class_id"] == school_class["id"]

    classes = client.get(f"/api/v1/school-classes?academic_year_id={year['id']}", headers=headers).json()
    assert len(classes) == 1
    sections = client.get(f"/api/v1/sections?school_class_id={school_class['id']}", headers=headers).json()
    assert len(sections) == 1


def test_creating_a_second_current_academic_year_unflags_the_first():
    headers, year, _school_class, _section = _setup_school()

    second = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2027-28", "start_date": "2027-06-01", "end_date": "2028-04-30", "is_current": True},
    )
    assert second.status_code == 201, second.text

    years = {y["id"]: y for y in client.get("/api/v1/academic-years", headers=headers).json()}
    assert years[year["id"]]["is_current"] is False
    assert years[second.json()["id"]]["is_current"] is True


def test_admission_numbers_are_server_generated_and_sequential():
    headers, _year, _school_class, _section = _setup_school()

    first = client.post("/api/v1/students", headers=headers, json={"first_name": "Asha", "last_name": "Rao", "admission_date": "2026-06-01"})
    second = client.post("/api/v1/students", headers=headers, json={"first_name": "Ravi", "last_name": "Kumar", "admission_date": "2026-06-01"})
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["admission_number"] == "STU-0001"
    assert second.json()["admission_number"] == "STU-0002"


def test_connected_student_lifecycle_admission_to_enrolment_to_guardian():
    """The spec's own differentiator: a student created with a class/
    section gets a real, queryable enrolment row -- not a flat record
    with no link to the academic structure."""
    headers, year, school_class, section = _setup_school()

    student_resp = client.post(
        "/api/v1/students", headers=headers,
        json={
            "first_name": "Priya", "last_name": "Sharma", "date_of_birth": "2015-04-12", "gender": "female",
            "admission_date": "2026-06-01", "category": "general",
            "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "5",
        },
    )
    assert student_resp.status_code == 201, student_resp.text
    student = student_resp.json()
    assert student["admission_number"] == "STU-0001"
    assert student["status"] == "active"

    enrolments = client.get(f"/api/v1/students/{student['id']}/enrolments", headers=headers).json()
    assert len(enrolments) == 1
    assert enrolments[0]["academic_year_id"] == year["id"]
    assert enrolments[0]["school_class_id"] == school_class["id"]
    assert enrolments[0]["section_id"] == section["id"]
    assert enrolments[0]["roll_number"] == "5"

    # Guardian: created standalone, then linked -- supports the spec's
    # own "sibling relationships" (the same Guardian could link to a
    # second Student later without duplicating their contact details).
    guardian_resp = client.post(
        "/api/v1/guardians", headers=headers,
        json={"full_name": "Mrs. Sharma", "phone": "9876543210", "email": "sharma@example.com"},
    )
    assert guardian_resp.status_code == 201, guardian_resp.text
    guardian = guardian_resp.json()

    link_resp = client.post(
        f"/api/v1/students/{student['id']}/guardians", headers=headers,
        json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True},
    )
    assert link_resp.status_code == 201, link_resp.text
    assert link_resp.json()["guardian_id"] == guardian["id"]

    student_guardians = client.get(f"/api/v1/students/{student['id']}/guardians", headers=headers).json()
    assert len(student_guardians) == 1
    assert student_guardians[0]["relationship_type"] == "mother"

    # Duplicate link is rejected, not silently duplicated.
    dup = client.post(
        f"/api/v1/students/{student['id']}/guardians", headers=headers,
        json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True},
    )
    assert dup.status_code == 409, dup.text


def test_a_student_can_be_created_without_an_immediate_enrolment():
    """Spec's own "do not require every module to be configured before
    the school can start using the system" -- a bare admission record
    is a real, valid state, not an error."""
    headers, _year, _school_class, _section = _setup_school()

    resp = client.post("/api/v1/students", headers=headers, json={"first_name": "Kabir", "last_name": "Singh", "admission_date": "2026-06-01"})
    assert resp.status_code == 201, resp.text
    enrolments = client.get(f"/api/v1/students/{resp.json()['id']}/enrolments", headers=headers).json()
    assert enrolments == []


def test_duplicate_enrolment_for_the_same_academic_year_is_rejected():
    headers, year, school_class, section = _setup_school()
    student = client.post("/api/v1/students", headers=headers, json={"first_name": "Meera", "last_name": "Iyer", "admission_date": "2026-06-01"}).json()

    first = client.post(
        f"/api/v1/students/{student['id']}/enrolments", headers=headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"]},
    )
    assert first.status_code == 201, first.text

    second = client.post(
        f"/api/v1/students/{student['id']}/enrolments", headers=headers,
        json={"academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"]},
    )
    assert second.status_code == 409, second.text
