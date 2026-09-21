import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.models.examinations import Examination
from app.models.user import User
from app.schemas.examinations import (
    ExamMarkOut,
    ExamMarksBulkUpsert,
    ExaminationCreate,
    ExaminationOut,
    ExaminationUpdate,
    ExamRosterEntryOut,
    ExamSubjectScheduleCreate,
    ExamSubjectScheduleOut,
    ReportCardOut,
)
from app.services.examinations import (
    bulk_upsert_marks,
    create_examination,
    create_exam_subject_schedule,
    get_exam_roster,
    get_report_card,
    list_exam_subject_schedules,
    set_examination_lock,
    update_examination,
)

router = APIRouter(tags=["examinations"], dependencies=[Depends(require_module("education"))])


@router.get("/examinations", response_model=list[ExaminationOut])
def list_examinations(
    academic_year_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("examinations.view"))
) -> list[Examination]:
    stmt = select(Examination).order_by(Examination.start_date.desc())
    if academic_year_id:
        stmt = stmt.where(Examination.academic_year_id == academic_year_id)
    return db.execute(stmt).scalars().all()


@router.post("/examinations", response_model=ExaminationOut, status_code=201)
def create_examination_endpoint(
    payload: ExaminationCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.create"))
) -> Examination:
    return create_examination(db, tenant_id=user.tenant_id, **payload.model_dump())


@router.patch("/examinations/{examination_id}", response_model=ExaminationOut)
def update_examination_endpoint(
    examination_id: uuid.UUID, payload: ExaminationUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.edit"))
) -> Examination:
    return update_examination(db, tenant_id=user.tenant_id, examination_id=examination_id, **payload.model_dump())


@router.post("/examinations/{examination_id}/lock", response_model=ExaminationOut)
def lock_examination(
    examination_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.lock"))
) -> Examination:
    return set_examination_lock(db, tenant_id=user.tenant_id, examination_id=examination_id, is_locked=True)


@router.post("/examinations/{examination_id}/unlock", response_model=ExaminationOut)
def unlock_examination(
    examination_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.lock"))
) -> Examination:
    return set_examination_lock(db, tenant_id=user.tenant_id, examination_id=examination_id, is_locked=False)


@router.get("/examinations/{examination_id}/subjects", response_model=list[ExamSubjectScheduleOut])
def list_subjects_endpoint(
    examination_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.view"))
):
    return list_exam_subject_schedules(db, tenant_id=user.tenant_id, examination_id=examination_id)


@router.post("/examinations/{examination_id}/subjects", response_model=ExamSubjectScheduleOut, status_code=201)
def create_subject_schedule_endpoint(
    examination_id: uuid.UUID, payload: ExamSubjectScheduleCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.create"))
):
    return create_exam_subject_schedule(db, tenant_id=user.tenant_id, examination_id=examination_id, **payload.model_dump())


@router.get("/examinations/subjects/{schedule_id}/roster", response_model=list[ExamRosterEntryOut])
def roster_endpoint(
    schedule_id: uuid.UUID, section_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.view"))
):
    return get_exam_roster(db, tenant_id=user.tenant_id, schedule_id=schedule_id, section_id=section_id)


@router.post("/examinations/subjects/{schedule_id}/marks/bulk", response_model=list[ExamMarkOut])
def bulk_marks_endpoint(
    schedule_id: uuid.UUID, payload: ExamMarksBulkUpsert, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.edit"))
):
    return bulk_upsert_marks(db, tenant_id=user.tenant_id, schedule_id=schedule_id, records=[r.model_dump() for r in payload.records])


@router.get("/examinations/{examination_id}/report-card/{student_id}", response_model=ReportCardOut)
def report_card_endpoint(
    examination_id: uuid.UUID, student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("examinations.view"))
):
    return get_report_card(db, tenant_id=user.tenant_id, examination_id=examination_id, student_id=student_id)
