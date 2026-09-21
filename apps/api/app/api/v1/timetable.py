import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.tenant import Company
from app.models.timetable import Subject, TimetableSlot
from app.models.user import User
from app.schemas.timetable import (
    SubjectCreate,
    SubjectOut,
    SubjectUpdate,
    TeacherScheduleEntryOut,
    TimetableEntryOut,
    TimetableEntryUpsert,
    TimetableSlotCreate,
    TimetableSlotOut,
)
from app.services.timetable import (
    create_slot,
    create_subject,
    delete_timetable_entry,
    get_section_timetable,
    get_teacher_schedule,
    update_subject,
    upsert_timetable_entry,
)

router = APIRouter(tags=["timetable"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


# ------------------------------------------------------------------- Subjects

@router.get("/subjects", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("timetable.view"))) -> list[Subject]:
    return db.execute(select(Subject).where(Subject.is_active == True).order_by(Subject.name)).scalars().all()  # noqa: E712


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject_endpoint(
    payload: SubjectCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.create"))
) -> Subject:
    company = _company(db, user.tenant_id)
    return create_subject(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject_endpoint(
    subject_id: uuid.UUID, payload: SubjectUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.edit"))
) -> Subject:
    return update_subject(db, tenant_id=user.tenant_id, subject_id=subject_id, **payload.model_dump())


# -------------------------------------------------------------- Period slots

@router.get("/timetable-slots", response_model=list[TimetableSlotOut])
def list_slots(db: Session = Depends(get_db_tenant), _user=Depends(require_permission("timetable.view"))) -> list[TimetableSlot]:
    return db.execute(select(TimetableSlot).order_by(TimetableSlot.sequence)).scalars().all()


@router.post("/timetable-slots", response_model=TimetableSlotOut, status_code=201)
def create_slot_endpoint(
    payload: TimetableSlotCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.create"))
) -> TimetableSlot:
    company = _company(db, user.tenant_id)
    return create_slot(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


# ------------------------------------------------------------------- Entries

@router.get("/timetable", response_model=list[TimetableEntryOut])
def get_timetable(
    section_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.view"))
):
    return get_section_timetable(db, tenant_id=user.tenant_id, section_id=section_id)


@router.put("/timetable/entries", response_model=TimetableEntryOut)
def upsert_entry(
    payload: TimetableEntryUpsert, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.edit"))
):
    return upsert_timetable_entry(db, tenant_id=user.tenant_id, **payload.model_dump())


@router.delete("/timetable/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.edit"))
) -> None:
    delete_timetable_entry(db, tenant_id=user.tenant_id, entry_id=entry_id)


@router.get("/timetable/teacher/{employee_id}", response_model=list[TeacherScheduleEntryOut])
def teacher_schedule(
    employee_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("timetable.view"))
):
    return get_teacher_schedule(db, tenant_id=user.tenant_id, teacher_id=employee_id)
