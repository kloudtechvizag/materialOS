"""Timetable & Scheduling (spec sec10): subjects, the shared period
grid, and per-section weekly entries, exercised through the real HTTP
API -- including the teacher double-booking conflict check.
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


def _setup_tenant():
    slug = f"tt-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]
    school_class = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Grade 4", "sequence": 4}).json()
    section_a = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "A"}).json()
    section_b = client.post("/api/v1/sections", headers=headers, json={"school_class_id": school_class["id"], "name": "B"}).json()

    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Mathematics", "code": "MATH"}).json()

    slot1 = client.post(
        "/api/v1/timetable-slots", headers=headers,
        json={"name": "Period 1", "sequence": 1, "start_time": "09:00:00", "end_time": "09:45:00"},
    ).json()

    teacher = client.post(
        "/api/v1/employees", headers=headers,
        json={"branch_id": branch_id, "first_name": "Anita", "last_name": "Rao", "joining_date": "2026-01-01", "employment_type": "full_time"},
    ).json()

    return headers, section_a, section_b, subject, slot1, teacher


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-tt-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/timetable", headers=headers, params={"section_id": str(uuid.uuid4())})
    assert resp.status_code == 403, resp.text


def test_setting_a_cell_then_reading_the_section_grid_reflects_it():
    headers, section_a, _section_b, subject, slot1, teacher = _setup_tenant()

    resp = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"], "room": "101"},
    )
    assert resp.status_code == 200, resp.text
    entry = resp.json()
    assert entry["subject_id"] == subject["id"]
    assert entry["teacher_id"] == teacher["id"]

    grid = client.get("/api/v1/timetable", headers=headers, params={"section_id": section_a["id"]}).json()
    assert len(grid) == 1
    assert grid[0]["room"] == "101"


def test_resetting_the_same_cell_updates_in_place_not_duplicates():
    headers, section_a, _section_b, subject, slot1, teacher = _setup_tenant()

    client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"], "room": "101"},
    )
    resp = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"], "room": "202"},
    )
    assert resp.status_code == 200, resp.text

    grid = client.get("/api/v1/timetable", headers=headers, params={"section_id": section_a["id"]}).json()
    assert len(grid) == 1
    assert grid[0]["room"] == "202"


def test_same_teacher_double_booked_same_slot_different_section_is_rejected():
    headers, section_a, section_b, subject, slot1, teacher = _setup_tenant()

    ok = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"]},
    )
    assert ok.status_code == 200, ok.text

    clash = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_b["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"]},
    )
    assert clash.status_code == 409, clash.text
    assert clash.json()["error"]["code"] == "CONFLICT"


def test_cannot_schedule_a_subject_into_a_break_slot():
    headers, section_a, _section_b, subject, _slot1, teacher = _setup_tenant()

    break_slot = client.post(
        "/api/v1/timetable-slots", headers=headers,
        json={"name": "Recess", "sequence": 2, "start_time": "10:30:00", "end_time": "10:45:00", "is_break": True},
    ).json()

    resp = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": break_slot["id"], "subject_id": subject["id"], "teacher_id": teacher["id"]},
    )
    assert resp.status_code == 400, resp.text


def test_deleting_an_entry_clears_the_cell():
    headers, section_a, _section_b, subject, slot1, teacher = _setup_tenant()

    entry = client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"]},
    ).json()

    resp = client.delete(f"/api/v1/timetable/entries/{entry['id']}", headers=headers)
    assert resp.status_code == 204, resp.text

    grid = client.get("/api/v1/timetable", headers=headers, params={"section_id": section_a["id"]}).json()
    assert grid == []


def test_teacher_schedule_endpoint_reflects_their_assigned_periods():
    headers, section_a, section_b, subject, slot1, teacher = _setup_tenant()

    client.put(
        "/api/v1/timetable/entries", headers=headers,
        json={"section_id": section_a["id"], "day_of_week": 0, "slot_id": slot1["id"], "subject_id": subject["id"], "teacher_id": teacher["id"]},
    )

    schedule = client.get(f"/api/v1/timetable/teacher/{teacher['id']}", headers=headers).json()
    assert len(schedule) == 1
    assert schedule[0]["section_name"] == "A"
    assert schedule[0]["subject_name"] == "Mathematics"
    assert schedule[0]["school_class_name"] == "Grade 4"
