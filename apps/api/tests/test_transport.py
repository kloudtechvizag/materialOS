"""Transport (spec sec18): school bus routes built on the existing
core Vehicle/Driver masters, stops, and per-year student assignment --
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


def _setup_tenant_with_route():
    slug = f"tr-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    vehicle = client.post("/api/v1/vehicles", headers=headers, json={"branch_id": branch_id, "registration_number": "KA01AB1234", "vehicle_type": "school bus"}).json()
    driver = client.post("/api/v1/drivers", headers=headers, json={"branch_id": branch_id, "name": "Ramesh Kumar", "phone": "9988776655", "license_number": "DL123"}).json()

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "name": "Grade 6", "sequence": 6}).json()
    section = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    student = client.post(
        "/api/v1/students", headers=headers,
        json={
            "first_name": "Kiran", "last_name": "Rao", "admission_date": "2026-06-01",
            "academic_year_id": year["id"], "school_class_id": school_class["id"], "section_id": section["id"], "roll_number": "1",
        },
    ).json()

    route = client.post("/api/v1/transport-routes", headers=headers, json={"name": "Route 1 - North", "vehicle_id": vehicle["id"], "driver_id": driver["id"]}).json()
    stop = client.post(f"/api/v1/transport-routes/{route['id']}/stops", headers=headers, json={"name": "Church Street", "sequence": 1, "pickup_time": "07:30:00", "drop_time": "15:30:00"}).json()

    return slug, headers, year, student, vehicle, driver, route, stop


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-tr-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/transport-routes", headers=headers)
    assert resp.status_code == 403, resp.text


def test_creating_a_route_validates_vehicle_and_driver_exist():
    slug = f"tr-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.post("/api/v1/transport-routes", headers=headers, json={"name": "X", "vehicle_id": str(uuid.uuid4()), "driver_id": str(uuid.uuid4())})
    assert resp.status_code == 400, resp.text


def test_unassigned_student_has_no_transport_record():
    slug, headers, _year, student, *_rest = _setup_tenant_with_route()
    resp = client.get(f"/api/v1/students/{student['id']}/transport", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() is None


def test_assigning_a_student_reflects_on_roster_and_student_transport_view():
    slug, headers, year, student, vehicle, driver, route, stop = _setup_tenant_with_route()

    assign = client.post(
        f"/api/v1/students/{student['id']}/transport-assignment", headers=headers,
        json={"academic_year_id": year["id"], "route_id": route["id"], "stop_id": stop["id"]},
    )
    assert assign.status_code == 201, assign.text

    roster = client.get(f"/api/v1/transport-routes/{route['id']}/roster", headers=headers).json()
    assert len(roster) == 1
    assert roster[0]["student_id"] == student["id"]
    assert roster[0]["stop_name"] == "Church Street"

    student_transport = client.get(f"/api/v1/students/{student['id']}/transport", headers=headers).json()
    assert student_transport["route_name"] == "Route 1 - North"
    assert student_transport["vehicle_registration_number"] == "KA01AB1234"
    assert student_transport["driver_name"] == "Ramesh Kumar"
    assert student_transport["stop_name"] == "Church Street"


def test_reassigning_the_same_year_updates_in_place_not_duplicates():
    slug, headers, year, student, _vehicle, _driver, route, stop = _setup_tenant_with_route()

    other_stop = client.post(f"/api/v1/transport-routes/{route['id']}/stops", headers=headers, json={"name": "MG Road", "sequence": 2, "pickup_time": "07:40:00", "drop_time": "15:40:00"}).json()

    client.post(f"/api/v1/students/{student['id']}/transport-assignment", headers=headers, json={"academic_year_id": year["id"], "route_id": route["id"], "stop_id": stop["id"]})
    client.post(f"/api/v1/students/{student['id']}/transport-assignment", headers=headers, json={"academic_year_id": year["id"], "route_id": route["id"], "stop_id": other_stop["id"]})

    roster = client.get(f"/api/v1/transport-routes/{route['id']}/roster", headers=headers).json()
    assert len(roster) == 1
    assert roster[0]["stop_name"] == "MG Road"


def test_assigning_a_stop_from_a_different_route_is_rejected():
    slug, headers, year, student, vehicle, driver, route, stop = _setup_tenant_with_route()
    other_route = client.post("/api/v1/transport-routes", headers=headers, json={"name": "Route 2", "vehicle_id": vehicle["id"], "driver_id": driver["id"]}).json()

    resp = client.post(
        f"/api/v1/students/{student['id']}/transport-assignment", headers=headers,
        json={"academic_year_id": year["id"], "route_id": other_route["id"], "stop_id": stop["id"]},
    )
    assert resp.status_code == 400, resp.text


def test_guardian_portal_shows_their_childs_real_transport_assignment():
    slug, headers, year, student, _vehicle, _driver, route, stop = _setup_tenant_with_route()

    client.post(f"/api/v1/students/{student['id']}/transport-assignment", headers=headers, json={"academic_year_id": year["id"], "route_id": route["id"], "stop_id": stop["id"]})

    guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Mrs. Rao"}).json()
    client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "mother", "is_primary_contact": True})
    client.post(f"/api/v1/guardians/{guardian['id']}/portal-access", headers=headers, json={"email": f"raomom-{slug}@example.com", "password": "guardian-pass-123", "full_name": "Mrs. Rao"})

    token = _login(slug, f"raomom-{slug}@example.com", "guardian-pass-123")
    guardian_headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"/api/v1/guardian-portal/children/{student['id']}/transport", headers=guardian_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["stop_name"] == "Church Street"
