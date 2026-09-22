"""Analytics & Reporting (Phase 7): every number is computed on read
from real tables written by every other module in this vertical --
exercised through the real HTTP API with hand-picked data so the
resulting percentages are exactly checkable, not just "non-zero."
"""
import uuid
from datetime import date, timedelta

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


def test_module_gated_a_non_school_tenant_gets_403():
    slug = f"nonschool-an-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug, industry_slug="building_materials")
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/analytics/overview", headers=headers)
    assert resp.status_code == 403, resp.text


def test_overview_is_honest_when_nothing_exists_yet():
    slug = f"an-empty-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/analytics/overview", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_active_students"] == 0
    assert body["attendance_pct_last_30_days"] is None
    assert body["fee_collection_pct"] is None
    assert body["hostel_occupancy_pct"] is None


def test_analytics_reflect_real_hand_picked_data_exactly():
    slug = f"an-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}
    branch_id = client.get("/api/v1/branches", headers=headers).json()[0]["id"]

    year = client.post(
        "/api/v1/academic-years", headers=headers,
        json={"name": "2026-27", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    ).json()
    class_a = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Class A", "sequence": 1}).json()
    class_b = client.post("/api/v1/school-classes", headers=headers, json={"academic_year_id": year["id"], "branch_id": branch_id, "name": "Class B", "sequence": 2}).json()
    section_a = client.post("/api/v1/sections", headers=headers, json={"school_class_id": class_a["id"], "name": "A"}).json()
    section_b = client.post("/api/v1/sections", headers=headers, json={"school_class_id": class_b["id"], "name": "A"}).json()

    def make_student(cls, section, first):
        return client.post(
            "/api/v1/students", headers=headers,
            json={"branch_id": branch_id, "first_name": first, "last_name": "Test", "admission_date": "2026-06-01", "academic_year_id": year["id"], "school_class_id": cls["id"], "section_id": section["id"], "roll_number": "1"},
        ).json()

    a1 = make_student(class_a, section_a, "A1")
    a2 = make_student(class_a, section_a, "A2")
    b1 = make_student(class_b, section_b, "B1")
    b2 = make_student(class_b, section_b, "B2")

    # Attendance: Class A 1/2 present, Class B 2/2 present -> overall 3/4 = 75%
    client.post("/api/v1/student-attendance/bulk", headers=headers, json={"section_id": section_a["id"], "attendance_date": "2026-09-20", "records": [{"student_id": a1["id"], "status": "present"}, {"student_id": a2["id"], "status": "absent"}]})
    client.post("/api/v1/student-attendance/bulk", headers=headers, json={"section_id": section_b["id"], "attendance_date": "2026-09-20", "records": [{"student_id": b1["id"], "status": "present"}, {"student_id": b2["id"], "status": "present"}]})

    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["total_active_students"] == 4
    assert overview["attendance_pct_last_30_days"] == 75.0

    trend = client.get("/api/v1/analytics/attendance-trend", headers=headers, params={"days": 30}).json()
    assert len(trend) == 1
    assert trend[0]["attendance_pct"] == 75.0

    by_class = {row["school_class_name"]: row["attendance_pct"] for row in client.get("/api/v1/analytics/attendance-by-class", headers=headers).json()}
    assert by_class["Class A"] == 50.0
    assert by_class["Class B"] == 100.0

    # Fees: Class A only, 1000 each, one student pays 500 -> invoiced 2000, collected 500 -> 25%
    for student in (a1, a2):
        guardian = client.post("/api/v1/guardians", headers=headers, json={"full_name": f"Parent of {student['first_name']}"}).json()
        client.post(f"/api/v1/students/{student['id']}/guardians", headers=headers, json={"guardian_id": guardian["id"], "relationship_type": "father", "is_primary_contact": True})

    fee_head = client.post("/api/v1/fee-heads", headers=headers, json={"name": "Tuition", "code": "TUITION"}).json()
    structure = client.post("/api/v1/fee-structure-items", headers=headers, json={"academic_year_id": year["id"], "school_class_id": class_a["id"], "fee_head_id": fee_head["id"], "amount": "1000", "due_date": "2026-10-15"}).json()
    gen = client.post("/api/v1/fee-invoices/generate", headers=headers, json={"school_class_id": class_a["id"], "branch_id": branch_id, "fee_structure_item_ids": [structure["id"]]}).json()
    inv = gen["created"][0]
    client.post("/api/v1/receipts", headers=headers, json={"customer_id": inv["customer_id"], "amount": "500", "mode": "cash", "reference_note": "test", "invoice_id": inv["invoice_id"]})

    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["fee_collection_pct"] == 25.0

    fee_by_class = {row["school_class_name"]: row for row in client.get("/api/v1/analytics/fee-collection-by-class", headers=headers).json()}
    assert fee_by_class["Class A"]["invoiced"] == "2000.0000"
    assert fee_by_class["Class A"]["collected"] == "500.0000"

    # Exam: Class A, one subject, marks 80 and 60 -> average 70%
    subject = client.post("/api/v1/subjects", headers=headers, json={"name": "Math", "code": "MATH"}).json()
    exam = client.post("/api/v1/examinations", headers=headers, json={"academic_year_id": year["id"], "name": "Term 1", "start_date": "2026-09-25", "end_date": "2026-09-26"}).json()
    schedule = client.post(f"/api/v1/examinations/{exam['id']}/subjects", headers=headers, json={"school_class_id": class_a["id"], "subject_id": subject["id"], "max_marks": "100", "pass_marks": "33"}).json()
    client.post(f"/api/v1/examinations/subjects/{schedule['id']}/marks/bulk", headers=headers, json={"records": [{"student_id": a1["id"], "marks_obtained": "80"}, {"student_id": a2["id"], "marks_obtained": "60"}]})

    perf = client.get("/api/v1/analytics/exam-performance", headers=headers, params={"examination_id": exam["id"]}).json()
    assert len(perf) == 1
    assert perf[0]["average_pct"] == 70.0
    assert perf[0]["students_marked"] == 2

    # Homework: Class A section, 1 submitted 1 missing -> 50%
    hw = client.post("/api/v1/homework", headers=headers, json={"section_id": section_a["id"], "subject_id": subject["id"], "title": "HW1", "assigned_date": "2026-09-20", "due_date": "2026-09-25"}).json()
    client.post(f"/api/v1/homework/{hw['id']}/submissions/bulk", headers=headers, json={"records": [{"student_id": a1["id"], "status": "submitted"}, {"student_id": a2["id"], "status": "missing"}]})

    completion = client.get("/api/v1/analytics/homework-completion", headers=headers).json()
    assert len(completion) == 1
    assert completion[0]["completion_pct"] == 50.0
    assert completion[0]["tracked_submissions"] == 2

    # Library: one issued book -> count 1
    book = client.post("/api/v1/library/books", headers=headers, json={"title": "Test Book"}).json()
    copy = client.post(f"/api/v1/library/books/{book['id']}/copies", headers=headers, json={"branch_id": branch_id, "accession_number": "ACC-1"}).json()
    client.post("/api/v1/library/issues", headers=headers, json={"book_copy_id": copy["id"], "student_id": a1["id"], "due_date": str(date.today() + timedelta(days=14))})

    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["library_books_issued"] == 1

    # Hostel: 1 room capacity 2, 1 bed allocated -> 50% occupancy
    hostel = client.post("/api/v1/hostels", headers=headers, json={"branch_id": branch_id, "name": "Hostel 1"}).json()
    room = client.post(f"/api/v1/hostels/{hostel['id']}/rooms", headers=headers, json={"room_number": "101", "capacity": 2}).json()
    client.post(f"/api/v1/students/{a1['id']}/hostel-allocation", headers=headers, json={"academic_year_id": year["id"], "room_id": room["id"], "bed_number": 1})

    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["hostel_occupancy_pct"] == 50.0
    assert overview["hostel_occupied_beds"] == 1
    assert overview["hostel_total_beds"] == 2

    # Transport: 1 route, 1 student assigned
    vehicle = client.post("/api/v1/vehicles", headers=headers, json={"branch_id": branch_id, "registration_number": "KA01AB0001", "vehicle_type": "bus"}).json()
    driver = client.post("/api/v1/drivers", headers=headers, json={"branch_id": branch_id, "name": "Driver One"}).json()
    route = client.post("/api/v1/transport-routes", headers=headers, json={"name": "Route 1", "vehicle_id": vehicle["id"], "driver_id": driver["id"]}).json()
    stop = client.post(f"/api/v1/transport-routes/{route['id']}/stops", headers=headers, json={"name": "Stop 1", "sequence": 1, "pickup_time": "07:00:00", "drop_time": "15:00:00"}).json()
    client.post(f"/api/v1/students/{a1['id']}/transport-assignment", headers=headers, json={"academic_year_id": year["id"], "route_id": route["id"], "stop_id": stop["id"]})

    overview = client.get("/api/v1/analytics/overview", headers=headers).json()
    assert overview["transport_students_assigned"] == 1
    assert overview["transport_routes"] == 1
