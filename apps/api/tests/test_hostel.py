"""Hostel (spec sec19): hostel buildings, rooms, and per-year bed
allocation, built on the existing core Employee model for wardens --
exercised through the real HTTP API, including the Guardian Portal
(ADR-032) view.
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


def _login(slug: str, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"tenant_slug": slug, "email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _setup_tenant_with_room_and_student():
    slug = f"host-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    warden = client.post("/api/v1/employees", headers=headers, json={"branch_id": branch_id, "first_name": "Geeta", "last_name": "Menon", "joining_date": "2026-01-01", "employment_type": "full_time"}).json()

    hostel = client.post("/api/v1/hostels", headers=headers, json={"name": "Sunrise Girls Hostel", "hostel_type": "girls", "warden_id": warden["id"]}).json()
    room = client.post(f"/api/v1/hostels/{hostel['id']}/rooms", headers=headers, json={"room_number": "G-101", "floor": "1", "capacity": 2}).json()

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 8", "sequence": 8}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=headers,
        json={"first_name": "Priya", "last_name": "Nambiar", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1"},
    ).json()

    return slug, headers, year, hostel, room, warden, student


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-host-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/hostels", headers=headers)
    assert resp.status_code == 403, resp.text


def test_creating_a_room_validates_capacity():
    slug = f"host-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    hostel = client.post("/api/v1/hostels", headers=headers, json={"name": "X"}).json()
    resp = client.post(f"/api/v1/hostels/{hostel['id']}/rooms", headers=headers, json={"room_number": "1", "capacity": 0})
    assert resp.status_code == 400, resp.text


def test_allocating_a_student_reflects_on_room_occupancy_and_student_view():
    slug, headers, year, _hostel, room, warden, student = _setup_tenant_with_room_and_student()

    resp = client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})
    assert resp.status_code == 201, resp.text

    occupancy = client.get(f"/api/v1/hostel-rooms/{room['id']}/occupancy", headers=headers).json()
    assert len(occupancy["occupants"]) == 1
    assert occupancy["occupants"][0]["student_id"] == student["id"]
    assert occupancy["occupants"][0]["bed_number"] == 1

    student_hostel = client.get(f"/api/v1/students/{student['id']}/hostel", headers=headers).json()
    assert student_hostel["hostel_name"] == "Sunrise Girls Hostel"
    assert student_hostel["room_number"] == "G-101"
    assert student_hostel["bed_number"] == 1
    assert student_hostel["warden_name"] == "Geeta Menon"


def test_allocating_a_bed_number_beyond_capacity_is_rejected():
    slug, headers, year, _hostel, room, _warden, student = _setup_tenant_with_room_and_student()
    resp = client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 3})
    assert resp.status_code == 400, resp.text


def test_allocating_an_occupied_bed_to_a_different_student_is_rejected():
    slug, headers, year, _hostel, room, _warden, student = _setup_tenant_with_room_and_student()
    client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})

    other_student = client.post(
        "/api/v1/students", headers=headers, json={"first_name": "Other", "last_name": "Kid", "admission_date": "2026-06-01"},
    ).json()
    resp = client.post(f"/api/v1/students/{other_student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})
    assert resp.status_code == 409, resp.text


def test_reallocating_the_same_year_updates_in_place_not_duplicates():
    slug, headers, year, _hostel, room, _warden, student = _setup_tenant_with_room_and_student()
    client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})
    client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 2})

    occupancy = client.get(f"/api/v1/hostel-rooms/{room['id']}/occupancy", headers=headers).json()
    assert len(occupancy["occupants"]) == 1
    assert occupancy["occupants"][0]["bed_number"] == 2


def test_guardian_portal_shows_their_childs_real_hostel_allocation():
    slug, headers, year, _hostel, room, _warden, student = _setup_tenant_with_room_and_student()
    client.post(f"/api/v1/students/{student['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})

    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Mrs. Nambiar"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})
    client.post(f"/api/v1/guardians/{guardian['id']}/portal-access", headers=headers, json={"email": f"nambiarmom-{slug}@example.com", "password": "guardian-pass-123", "full_name": "Mrs. Nambiar"})

    token = _login(slug, f"nambiarmom-{slug}@example.com", "guardian-pass-123")
    resp = client.get(f"/api/v1/guardian-portal/children/{student['id']}/hostel", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["room_number"] == "G-101"
