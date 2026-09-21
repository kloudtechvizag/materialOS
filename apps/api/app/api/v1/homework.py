import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.models.user import User
from app.schemas.homework import (
    HomeworkCreate,
    HomeworkOut,
    HomeworkRosterEntryOut,
    HomeworkSubmissionsBulkUpsert,
    HomeworkUpdate,
    StudentHomeworkEntryOut,
)
from app.services.homework import (
    bulk_upsert_submissions,
    create_homework,
    get_homework_roster,
    get_student_homework,
    list_homework,
    update_homework,
)

router = APIRouter(tags=["homework"], dependencies=[Depends(require_module("education"))])


@router.get("/homework", response_model=list[HomeworkOut])
def list_homework_endpoint(
    section_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.view"))
):
    return list_homework(db, tenant_id=user.tenant_id, section_id=section_id)


@router.post("/homework", response_model=HomeworkOut, status_code=201)
def create_homework_endpoint(
    payload: HomeworkCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.create"))
):
    return create_homework(db, tenant_id=user.tenant_id, created_by_user_id=user.id, **payload.model_dump())


@router.patch("/homework/{homework_id}", response_model=HomeworkOut)
def update_homework_endpoint(
    homework_id: uuid.UUID, payload: HomeworkUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.edit"))
):
    return update_homework(db, tenant_id=user.tenant_id, homework_id=homework_id, **payload.model_dump())


@router.get("/homework/{homework_id}/roster", response_model=list[HomeworkRosterEntryOut])
def homework_roster_endpoint(
    homework_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.view"))
):
    return get_homework_roster(db, tenant_id=user.tenant_id, homework_id=homework_id)


@router.post("/homework/{homework_id}/submissions/bulk", response_model=list[HomeworkRosterEntryOut])
def bulk_submissions_endpoint(
    homework_id: uuid.UUID, payload: HomeworkSubmissionsBulkUpsert, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.edit"))
):
    bulk_upsert_submissions(db, tenant_id=user.tenant_id, homework_id=homework_id, records=[r.model_dump() for r in payload.records])
    return get_homework_roster(db, tenant_id=user.tenant_id, homework_id=homework_id)


@router.get("/students/{student_id}/homework", response_model=list[StudentHomeworkEntryOut])
def student_homework_endpoint(
    student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.view"))
):
    return get_student_homework(db, tenant_id=user.tenant_id, student_id=student_id)
