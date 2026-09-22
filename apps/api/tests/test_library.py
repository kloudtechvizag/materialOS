"""Library (spec sec19): book catalog, individually-tracked physical
copies, and circulation (issue/return with fines) -- exercised through
the real HTTP API, including the Guardian Portal (ADR-032) view.
"""
import uuid
from datetime import date, timedelta
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


def _setup_tenant_with_book_and_student():
    slug = f"lib-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    book = client.post("/api/v1/library/books", headers=headers, json={"title": "Wings of Fire", "author": "A.P.J. Abdul Kalam", "isbn": "9788173711466"}).json()
    copy = client.post(f"/api/v1/library/books/{book['id']}/copies", headers=headers, json={"branch_id": branch_id, "accession_number": "ACC-0001"}).json()

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 7", "sequence": 7}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=headers,
        json={"branch_id": branch_id, "first_name": "Ananya", "last_name": "Bose", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()

    return slug, headers, book, copy, student


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-lib-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/library/books", headers=headers)
    assert resp.status_code == 403, resp.text


def test_issuing_a_book_marks_the_copy_issued_and_appears_in_active_issues():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()

    due = str(date.today() + timedelta(days=14))
    resp = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due})
    assert resp.status_code == 201, resp.text
    issue = resp.json()
    assert issue["status"] == "issued"
    assert issue["book_title"] == "Wings of Fire"
    assert issue["is_overdue"] is False

    copies = client.get(f"/api/v1/library/books/{copy['book_id']}/copies", headers=headers).json()
    assert copies[0]["status"] == "issued"

    active = client.get("/api/v1/library/issues", headers=headers).json()
    assert len(active) == 1
    assert active[0]["id"] == issue["id"]


def test_issuing_an_already_issued_copy_is_rejected():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()
    due = str(date.today() + timedelta(days=14))
    client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due})

    other_student = client.post(
        "/api/v1/students", headers=headers, json={"branch_id": student["branch_id"], "first_name": "Other", "last_name": "Kid", "admission_date": "2026-06-01"},
    ).json()
    resp = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": other_student["id"], "due_date": due})
    assert resp.status_code == 409, resp.text


def test_returning_on_time_has_no_fine_and_frees_the_copy():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()
    due = str(date.today() + timedelta(days=14))
    issue = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due}).json()

    resp = client.post(f"/api/v1/library/issues/{issue['id']}/return", headers=headers, json={})
    assert resp.status_code == 200, resp.text
    returned = resp.json()
    assert returned["status"] == "returned"
    assert Decimal(returned["fine_amount"]) == Decimal("0")

    active = client.get("/api/v1/library/issues", headers=headers).json()
    assert active == []

    copies = client.get(f"/api/v1/library/books/{copy['book_id']}/copies", headers=headers).json()
    assert copies[0]["status"] == "available"


def test_staff_can_override_the_fine_amount_on_return():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()
    due = str(date.today() + timedelta(days=14))
    issue = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due}).json()

    resp = client.post(f"/api/v1/library/issues/{issue['id']}/return", headers=headers, json={"fine_amount": "25"})
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["fine_amount"]) == Decimal("25")


def test_marking_a_book_lost_keeps_the_copy_unavailable():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()
    due = str(date.today() + timedelta(days=14))
    issue = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due}).json()

    resp = client.post(f"/api/v1/library/issues/{issue['id']}/return", headers=headers, json={"lost": True, "fine_amount": "500"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "lost"

    copies = client.get(f"/api/v1/library/books/{copy['book_id']}/copies", headers=headers).json()
    assert copies[0]["status"] == "lost"

    # Even a fresh copy of the same title can still be issued -- only this one copy is unavailable.
    new_copy = client.post(f"/api/v1/library/books/{copy['book_id']}/copies", headers=headers, json={"branch_id": copy["branch_id"], "accession_number": "ACC-0002"}).json()
    reissue = client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": new_copy["id"], "student_id": student["id"], "due_date": due})
    assert reissue.status_code == 201, reissue.text


def test_guardian_portal_shows_their_childs_real_library_history():
    slug, headers, _book, copy, student = _setup_tenant_with_book_and_student()
    due = str(date.today() + timedelta(days=14))
    client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": student["id"], "due_date": due})

    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Mrs. Bose"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})
    client.post(f"/api/v1/guardians/{guardian['id']}/portal-access", headers=headers, json={"email": f"bosemom-{slug}@example.com", "password": "guardian-pass-123", "full_name": "Mrs. Bose"})

    token = _login(slug, f"bosemom-{slug}@example.com", "guardian-pass-123")
    resp = client.get(f"/api/v1/guardian-portal/children/{student['id']}/library", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    history = resp.json()
    assert len(history) == 1
    assert history[0]["book_title"] == "Wings of Fire"
    assert history[0]["status"] == "issued"
