import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.education import AcademicYear, Student
from app.models.hostel import Hostel, HostelRoom, StudentHostelAllocation
from app.models.hr import Employee


def create_hostel(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, name: str, hostel_type: str, warden_id: uuid.UUID | None
) -> Hostel:
    if warden_id is not None:
        warden = db.get(Employee, warden_id)
        if warden is None or warden.tenant_id != tenant_id:
            raise AppError(ErrorCode.VALIDATION_ERROR, "Warden not found.")

    hostel = Hostel(tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, name=name, hostel_type=hostel_type, warden_id=warden_id)
    db.add(hostel)
    db.flush()
    return hostel


def list_hostels(db: Session, *, tenant_id: uuid.UUID, branch_id: uuid.UUID | None = None) -> list[Hostel]:
    stmt = select(Hostel).where(Hostel.tenant_id == tenant_id, Hostel.is_active.is_(True)).order_by(Hostel.name)
    if branch_id:
        stmt = stmt.where(Hostel.branch_id == branch_id)
    return db.execute(stmt).scalars().all()


def _hostel(db: Session, tenant_id: uuid.UUID, hostel_id: uuid.UUID) -> Hostel:
    hostel = db.get(Hostel, hostel_id)
    if hostel is None or hostel.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Hostel not found.", status_code=404)
    return hostel


def create_room(db: Session, *, tenant_id: uuid.UUID, hostel_id: uuid.UUID, room_number: str, floor: str | None, capacity: int) -> HostelRoom:
    _hostel(db, tenant_id, hostel_id)
    if capacity < 1:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Room capacity must be at least 1.")
    room = HostelRoom(tenant_id=tenant_id, hostel_id=hostel_id, room_number=room_number, floor=floor, capacity=capacity)
    db.add(room)
    db.flush()
    return room


def list_rooms(db: Session, *, tenant_id: uuid.UUID, hostel_id: uuid.UUID) -> list[HostelRoom]:
    _hostel(db, tenant_id, hostel_id)
    return db.execute(
        select(HostelRoom).where(HostelRoom.tenant_id == tenant_id, HostelRoom.hostel_id == hostel_id).order_by(HostelRoom.room_number)
    ).scalars().all()


def _room(db: Session, tenant_id: uuid.UUID, room_id: uuid.UUID) -> HostelRoom:
    room = db.get(HostelRoom, room_id)
    if room is None or room.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Room not found.", status_code=404)
    return room


def get_room_occupancy(db: Session, *, tenant_id: uuid.UUID, room_id: uuid.UUID) -> dict:
    room = _room(db, tenant_id, room_id)
    rows = db.execute(
        select(StudentHostelAllocation, Student)
        .join(Student, Student.id == StudentHostelAllocation.student_id)
        .join(AcademicYear, AcademicYear.id == StudentHostelAllocation.academic_year_id)
        .where(StudentHostelAllocation.tenant_id == tenant_id, StudentHostelAllocation.room_id == room_id, AcademicYear.is_current.is_(True))
        .order_by(StudentHostelAllocation.bed_number)
    ).all()

    return {
        "room_id": room.id, "room_number": room.room_number, "capacity": room.capacity,
        "occupants": [{"student_id": s.id, "first_name": s.first_name, "last_name": s.last_name, "bed_number": a.bed_number} for a, s in rows],
    }


def allocate_student(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID, academic_year_id: uuid.UUID, room_id: uuid.UUID, bed_number: int) -> StudentHostelAllocation:
    student = db.get(Student, student_id)
    if student is None or student.tenant_id != tenant_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Student not found.")
    room = _room(db, tenant_id, room_id)
    hostel = db.get(Hostel, room.hostel_id)
    if student.branch_id != hostel.branch_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This hostel belongs to a different campus than the student's own campus.")
    if bed_number < 1 or bed_number > room.capacity:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Bed number must be between 1 and this room's capacity ({room.capacity}).")

    occupant = db.execute(
        select(StudentHostelAllocation).where(
            StudentHostelAllocation.tenant_id == tenant_id, StudentHostelAllocation.room_id == room_id,
            StudentHostelAllocation.bed_number == bed_number, StudentHostelAllocation.academic_year_id == academic_year_id,
        )
    ).scalar_one_or_none()
    if occupant is not None and occupant.student_id != student_id:
        raise AppError(ErrorCode.CONFLICT, "That bed is already occupied this academic year.", status_code=409)

    existing = db.execute(
        select(StudentHostelAllocation).where(
            StudentHostelAllocation.tenant_id == tenant_id, StudentHostelAllocation.student_id == student_id,
            StudentHostelAllocation.academic_year_id == academic_year_id,
        )
    ).scalar_one_or_none()

    if existing is not None:
        existing.room_id = room_id
        existing.bed_number = bed_number
        db.flush()
        return existing

    allocation = StudentHostelAllocation(tenant_id=tenant_id, student_id=student_id, academic_year_id=academic_year_id, room_id=room_id, bed_number=bed_number)
    db.add(allocation)
    db.flush()
    return allocation


def get_student_hostel(db: Session, *, tenant_id: uuid.UUID, student_id: uuid.UUID) -> dict | None:
    row = db.execute(
        select(StudentHostelAllocation)
        .join(AcademicYear, AcademicYear.id == StudentHostelAllocation.academic_year_id)
        .where(StudentHostelAllocation.tenant_id == tenant_id, StudentHostelAllocation.student_id == student_id, AcademicYear.is_current.is_(True))
    ).scalar_one_or_none()
    if row is None:
        return None

    room = db.get(HostelRoom, row.room_id)
    hostel = db.get(Hostel, room.hostel_id)
    warden = db.get(Employee, hostel.warden_id) if hostel.warden_id else None

    return {
        "hostel_name": hostel.name, "room_number": room.room_number, "bed_number": row.bed_number,
        "warden_name": f"{warden.first_name} {warden.last_name}" if warden else None,
        "warden_phone": warden.phone if warden else None,
    }
