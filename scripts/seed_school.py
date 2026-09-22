#!/usr/bin/env python3
"""School Management (Education) demo tenant -- Greenwood International
School. Same spirit as seed_retail.py/seed_pharmacy.py: real service
calls against a real session, no HTTP layer, no backdated/fabricated
history -- every row goes through the same validation the live app
would apply (enrolment, attendance roster resolution, fee invoice
generation with a real posted journal, etc).

Populates one section (Grade 3 - A) richly across every module this
vertical ships (see ADR-025 through ADR-036) -- timetable, attendance,
homework, an examination with real marks, fees with a real invoice and
partial payment, transport, library, and hostel -- plus enough breadth
elsewhere (Grade 3-B, Grade 4-A, Grade 5-A; an in-flight admissions
application; school-wide and class announcements) that every nav item
shows real data on first login, not an empty state everywhere except
one lucky page.

Run from apps/api with the venv active:
    DATABASE_URL=... python ../../scripts/seed_school.py
"""

import sys
import uuid
from datetime import date, time
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "api"))

from app.db import SessionLocal, set_session_context  # noqa: E402
from app.models.fleet import Driver, Vehicle  # noqa: E402
from app.schemas.tenant import TenantSignupRequest  # noqa: E402
from app.services.admissions import create_application, create_enquiry, transition_application  # noqa: E402
from app.services.announcements import create_announcement  # noqa: E402
from app.services.education import create_academic_year, create_guardian, create_school_class, create_section, create_student, link_guardian  # noqa: E402
from app.services.examinations import bulk_upsert_marks, create_exam_subject_schedule, create_examination  # noqa: E402
from app.services.fees import create_fee_head, create_fee_structure_item, generate_fee_invoices  # noqa: E402
from app.services.guardian_portal import create_guardian_portal_login  # noqa: E402
from app.services.hostel import allocate_student, create_hostel, create_room  # noqa: E402
from app.services.hr import create_employee  # noqa: E402
from app.services.industry import ensure_industry_profile_catalog  # noqa: E402
from app.services.library import create_book, create_copy, issue_book  # noqa: E402
from app.services.numbering import get_current_financial_year  # noqa: E402
from app.services.permissions import ensure_permission_catalog  # noqa: E402
from app.services.receipts import record_receipt  # noqa: E402
from app.services.student_attendance import mark_bulk_attendance  # noqa: E402
from app.services.homework import bulk_upsert_submissions, create_homework  # noqa: E402
from app.services.tenant_signup import signup_tenant  # noqa: E402
from app.services.timetable import create_slot, create_subject, upsert_timetable_entry  # noqa: E402
from app.services.transport import assign_student_to_route, create_route, create_stop  # noqa: E402

TENANT_SLUG = "greenwood-demo"
OWNER_EMAIL = "owner@greenwood-demo.example.com"
OWNER_PASSWORD = "demo-password-123"
GUARDIAN_PASSWORD = "demo-parent-123"

STUDENT_SEEDS = [
    # class,      section, first,     last,      guardian_name,   relationship
    ("Grade 3", "A", "Aarav", "Mehta", "Suresh Mehta", "father"),
    ("Grade 3", "A", "Diya", "Kapoor", "Neha Kapoor", "mother"),
    ("Grade 3", "A", "Vihaan", "Joshi", "Amit Joshi", "father"),
    ("Grade 3", "B", "Ishita", "Rao", "Lakshmi Rao", "mother"),
    ("Grade 3", "B", "Kabir", "Singh", "Manpreet Singh", "father"),
    ("Grade 4", "A", "Ananya", "Verma", "Sunita Verma", "mother"),
    ("Grade 4", "A", "Arjun", "Pillai", "Ravi Pillai", "father"),
    ("Grade 5", "A", "Saanvi", "Bose", "Ritu Bose", "mother"),
    ("Grade 5", "A", "Reyansh", "Nair", "Vinod Nair", "father"),
]


def main() -> None:
    db = SessionLocal()
    ensure_permission_catalog(db)
    ensure_industry_profile_catalog(db)
    db.commit()

    result = signup_tenant(
        db,
        TenantSignupRequest(
            tenant_name="Greenwood International School", tenant_slug=TENANT_SLUG,
            company_name="Greenwood International School", company_legal_name="Greenwood International School Trust",
            company_state="Karnataka", owner_full_name="Ramesh Iyer",
            owner_email=OWNER_EMAIL, owner_password=OWNER_PASSWORD, industry_slug="school_education",
        ),
    )
    tenant_id, company_id, branch_id, user_id = result["tenant_id"], result["company_id"], result["branch_id"], result["user_id"]
    set_session_context(db, tenant_id=str(tenant_id), user_id=str(user_id))

    # ------------------------------------------------------------- Academic
    year = create_academic_year(db, tenant_id=tenant_id, company_id=company_id, name="2026-27", start_date=date(2026, 6, 1), end_date=date(2027, 4, 30), is_current=True)

    classes = {name: create_school_class(db, tenant_id=tenant_id, company_id=company_id, academic_year_id=year.id, name=name, sequence=seq) for name, seq in [("Grade 3", 3), ("Grade 4", 4), ("Grade 5", 5)]}

    teacher_anita = create_employee(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, created_by_user_id=user_id, first_name="Anita", last_name="Sharma", joining_date=date(2020, 6, 1), employment_type="full_time", phone="9810000001")
    teacher_rajesh = create_employee(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, created_by_user_id=user_id, first_name="Rajesh", last_name="Kumar", joining_date=date(2020, 6, 1), employment_type="full_time", phone="9810000002")
    teacher_priya = create_employee(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, created_by_user_id=user_id, first_name="Priya", last_name="Nair", joining_date=date(2020, 6, 1), employment_type="full_time", phone="9810000003")
    warden_geeta = create_employee(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, created_by_user_id=user_id, first_name="Geeta", last_name="Menon", joining_date=date(2020, 6, 1), employment_type="full_time", phone="9810000005")

    sections = {
        ("Grade 3", "A"): create_section(db, tenant_id=tenant_id, school_class_id=classes["Grade 3"].id, name="A", capacity=30, class_teacher_id=teacher_anita.id),
        ("Grade 3", "B"): create_section(db, tenant_id=tenant_id, school_class_id=classes["Grade 3"].id, name="B", capacity=30, class_teacher_id=None),
        ("Grade 4", "A"): create_section(db, tenant_id=tenant_id, school_class_id=classes["Grade 4"].id, name="A", capacity=30, class_teacher_id=teacher_rajesh.id),
        ("Grade 5", "A"): create_section(db, tenant_id=tenant_id, school_class_id=classes["Grade 5"].id, name="A", capacity=30, class_teacher_id=teacher_priya.id),
    }
    g3a = sections[("Grade 3", "A")]

    subjects = {name: create_subject(db, tenant_id=tenant_id, company_id=company_id, name=name, code=code) for name, code in [("Mathematics", "MATH"), ("English", "ENG"), ("Science", "SCI"), ("Social Studies", "SST"), ("Hindi", "HIN")]}

    # --------------------------------------------------------------- Students
    students: list[dict] = []
    guardian_logins: list[dict] = []
    for i, (cls, sec, first, last, guardian_name, rel) in enumerate(STUDENT_SEEDS, start=1):
        section = sections[(cls, sec)]
        student = create_student(
            db, tenant_id=tenant_id, company_id=company_id, first_name=first, last_name=last, admission_date=date(2026, 6, 1),
            date_of_birth=date(2017 - (classes[cls].sequence - 3), 4, 15),
            academic_year_id=year.id, school_class_id=classes[cls].id, section_id=section.id, roll_number=str(i),
        )
        students.append({"student": student, "class": cls, "section": sec})

        g_first, g_last = guardian_name.split(" ", 1)
        guardian = create_guardian(db, tenant_id=tenant_id, full_name=guardian_name, phone=f"98200000{i:02d}")
        link_guardian(db, tenant_id=tenant_id, student_id=student.id, guardian_id=guardian.id, relationship_type=rel, is_primary_contact=True)

        if i <= 3:
            email = f"{g_first.lower()}.{g_last.lower()}@example.com"
            create_guardian_portal_login(db, tenant_id=tenant_id, guardian=guardian, email=email, password=GUARDIAN_PASSWORD, full_name=guardian_name)
            guardian_logins.append({"guardian": guardian_name, "child": f"{first} {last}", "email": email})

    g3a_students = [s["student"] for s in students if s["class"] == "Grade 3" and s["section"] == "A"]

    # -------------------------------------------------------------- Timetable
    slot1 = create_slot(db, tenant_id=tenant_id, company_id=company_id, name="Period 1", sequence=1, start_time=time(9, 0), end_time=time(9, 45), is_break=False)
    slot2 = create_slot(db, tenant_id=tenant_id, company_id=company_id, name="Period 2", sequence=2, start_time=time(9, 45), end_time=time(10, 30), is_break=False)
    create_slot(db, tenant_id=tenant_id, company_id=company_id, name="Recess", sequence=3, start_time=time(10, 30), end_time=time(10, 45), is_break=True)
    slot3 = create_slot(db, tenant_id=tenant_id, company_id=company_id, name="Period 3", sequence=4, start_time=time(10, 45), end_time=time(11, 30), is_break=False)
    for day in (0, 1, 2):
        upsert_timetable_entry(db, tenant_id=tenant_id, section_id=g3a.id, day_of_week=day, slot_id=slot1.id, subject_id=subjects["Mathematics"].id, teacher_id=teacher_anita.id, room="101")
        upsert_timetable_entry(db, tenant_id=tenant_id, section_id=g3a.id, day_of_week=day, slot_id=slot2.id, subject_id=subjects["English"].id, teacher_id=teacher_anita.id, room="101")
        upsert_timetable_entry(db, tenant_id=tenant_id, section_id=g3a.id, day_of_week=day, slot_id=slot3.id, subject_id=subjects["Science"].id, teacher_id=teacher_anita.id, room="101")

    # ------------------------------------------------------------- Attendance
    for d, statuses in [(date(2026, 9, 14), ["present", "present", "absent"]), (date(2026, 9, 15), ["present", "late", "present"]), (date(2026, 9, 16), ["present", "present", "present"])]:
        records = [{"student_id": s.id, "status": st} for s, st in zip(g3a_students, statuses)]
        mark_bulk_attendance(db, tenant_id=tenant_id, section_id=g3a.id, attendance_date=d, marked_by_user_id=user_id, records=records)

    # -------------------------------------------------------------- Homework
    hw1 = create_homework(db, tenant_id=tenant_id, section_id=g3a.id, subject_id=subjects["Mathematics"].id, title="Worksheet: Multiplication tables 2-5", description="Complete all 4 pages.", assigned_date=date(2026, 9, 15), due_date=date(2026, 9, 20), created_by_user_id=user_id)
    bulk_upsert_submissions(db, tenant_id=tenant_id, homework_id=hw1.id, records=[
        {"student_id": g3a_students[0].id, "status": "submitted"}, {"student_id": g3a_students[1].id, "status": "submitted"}, {"student_id": g3a_students[2].id, "status": "pending"},
    ])
    create_homework(db, tenant_id=tenant_id, section_id=g3a.id, subject_id=subjects["English"].id, title="Read Chapter 3 and answer questions", description=None, assigned_date=date(2026, 9, 18), due_date=date(2026, 9, 22), created_by_user_id=user_id)

    # ----------------------------------------------------------- Examinations
    exam = create_examination(db, tenant_id=tenant_id, academic_year_id=year.id, name="Mid Term 1", start_date=date(2026, 9, 25), end_date=date(2026, 9, 28))
    sched_math = create_exam_subject_schedule(db, tenant_id=tenant_id, examination_id=exam.id, school_class_id=classes["Grade 3"].id, subject_id=subjects["Mathematics"].id, exam_date=date(2026, 9, 25), max_marks=Decimal("100"), pass_marks=Decimal("33"))
    sched_eng = create_exam_subject_schedule(db, tenant_id=tenant_id, examination_id=exam.id, school_class_id=classes["Grade 3"].id, subject_id=subjects["English"].id, exam_date=date(2026, 9, 26), max_marks=Decimal("100"), pass_marks=Decimal("33"))
    bulk_upsert_marks(db, tenant_id=tenant_id, schedule_id=sched_math.id, records=[{"student_id": g3a_students[0].id, "marks_obtained": Decimal("88"), "is_absent": False}, {"student_id": g3a_students[1].id, "marks_obtained": Decimal("72"), "is_absent": False}, {"student_id": g3a_students[2].id, "marks_obtained": Decimal("45"), "is_absent": False}])
    bulk_upsert_marks(db, tenant_id=tenant_id, schedule_id=sched_eng.id, records=[{"student_id": g3a_students[0].id, "marks_obtained": Decimal("91"), "is_absent": False}, {"student_id": g3a_students[1].id, "marks_obtained": Decimal("68"), "is_absent": False}, {"student_id": g3a_students[2].id, "marks_obtained": Decimal("58"), "is_absent": False}])

    # ------------------------------------------------------------------ Fees
    fee_head = create_fee_head(db, tenant_id=tenant_id, company_id=company_id, name="Tuition Fee", code="TUITION")
    structure = create_fee_structure_item(db, tenant_id=tenant_id, academic_year_id=year.id, school_class_id=classes["Grade 3"].id, fee_head_id=fee_head.id, amount=Decimal("15000"), due_date=date(2026, 10, 15))
    gen = generate_fee_invoices(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, user_id=user_id, school_class_id=classes["Grade 3"].id, fee_structure_item_ids=[structure.id])
    if gen["created"]:
        inv = gen["created"][0]
        fy = get_current_financial_year(db, company_id)
        record_receipt(db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, financial_year_id=fy.id, customer_id=inv["customer_id"], amount=Decimal("5000"), mode="cash", reference_note="Part payment - Term 1", invoice_id=inv["invoice_id"])

    # -------------------------------------------------------------- Transport
    vehicle = Vehicle(tenant_id=tenant_id, branch_id=branch_id, registration_number="KA01AB1234", vehicle_type="school bus")
    db.add(vehicle)
    driver = Driver(tenant_id=tenant_id, branch_id=branch_id, name="Suresh Babu", phone="9810000004", license_number="DL1420110012345")
    db.add(driver)
    db.flush()
    route = create_route(db, tenant_id=tenant_id, company_id=company_id, name="Route 1 - Central", vehicle_id=vehicle.id, driver_id=driver.id)
    stop1 = create_stop(db, tenant_id=tenant_id, route_id=route.id, name="Church Street", sequence=1, pickup_time=time(7, 15), drop_time=time(15, 15))
    stop2 = create_stop(db, tenant_id=tenant_id, route_id=route.id, name="MG Road", sequence=2, pickup_time=time(7, 30), drop_time=time(15, 30))
    assign_student_to_route(db, tenant_id=tenant_id, student_id=g3a_students[0].id, academic_year_id=year.id, route_id=route.id, stop_id=stop1.id)
    assign_student_to_route(db, tenant_id=tenant_id, student_id=g3a_students[1].id, academic_year_id=year.id, route_id=route.id, stop_id=stop2.id)

    # ---------------------------------------------------------------- Library
    book1 = create_book(db, tenant_id=tenant_id, company_id=company_id, title="The Jungle Book", author="Rudyard Kipling", isbn="9780141336568", publisher=None, category="Fiction")
    copy1 = create_copy(db, tenant_id=tenant_id, book_id=book1.id, accession_number="ACC-1001")
    book2 = create_book(db, tenant_id=tenant_id, company_id=company_id, title="Panchatantra Tales", author="Vishnu Sharma", isbn=None, publisher=None, category="Fiction")
    copy2 = create_copy(db, tenant_id=tenant_id, book_id=book2.id, accession_number="ACC-1002")
    create_book(db, tenant_id=tenant_id, company_id=company_id, title="Wonders of Science", author="Various", isbn=None, publisher=None, category="Non-fiction")
    issue_book(db, tenant_id=tenant_id, book_copy_id=copy1.id, student_id=g3a_students[0].id, due_date=date(2026, 10, 10))
    issue_book(db, tenant_id=tenant_id, book_copy_id=copy2.id, student_id=g3a_students[1].id, due_date=date(2026, 10, 10))

    # ---------------------------------------------------------------- Hostel
    hostel = create_hostel(db, tenant_id=tenant_id, company_id=company_id, name="Greenwood Girls Hostel", hostel_type="girls", warden_id=warden_geeta.id)
    room = create_room(db, tenant_id=tenant_id, hostel_id=hostel.id, room_number="G-101", floor="1", capacity=2)
    allocate_student(db, tenant_id=tenant_id, student_id=g3a_students[1].id, academic_year_id=year.id, room_id=room.id, bed_number=1)

    # ------------------------------------------------------------- Admissions
    enquiry = create_enquiry(db, tenant_id=tenant_id, company_id=company_id, student_name="Kavya Reddy", desired_grade="Grade 3", guardian_name="Sunil Reddy", guardian_phone="9820099999", guardian_email="sunil.reddy@example.com", source="walk-in")
    application = create_application(db, tenant_id=tenant_id, company_id=company_id, enquiry_id=enquiry.id, first_name="Kavya", last_name="Reddy", desired_grade="Grade 3", academic_year_id=year.id, guardian_name="Sunil Reddy", guardian_phone="9820099999")
    transition_application(db, tenant_id=tenant_id, application_id=application.id, decided_by_user_id=user_id, status="interview_scheduled", interview_date=date(2026, 9, 22), decision_reason=None)

    # --------------------------------------------------------- Announcements
    create_announcement(db, tenant_id=tenant_id, company_id=company_id, published_by_user_id=user_id, title="Annual Day Celebration - Oct 15th", body="Join us for the Annual Day celebrations. All parents are invited from 4 PM onwards in the main auditorium.", target_type="school", target_school_class_id=None, target_section_id=None, expires_at=None)
    create_announcement(db, tenant_id=tenant_id, company_id=company_id, published_by_user_id=user_id, title="Grade 3 Field Trip Permission Slip", body="Please submit the signed permission slip for the science museum field trip by Friday.", target_type="class", target_school_class_id=classes["Grade 3"].id, target_section_id=None, expires_at=None)

    db.commit()

    print(f"School demo tenant ready: workspace '{TENANT_SLUG}', staff login {OWNER_EMAIL} / {OWNER_PASSWORD}")
    print(f"Guardian portal logins (password {GUARDIAN_PASSWORD}):")
    for g in guardian_logins:
        print(f"  {g['email']}  ({g['guardian']}, parent of {g['child']})")


if __name__ == "__main__":
    main()
