import mimetypes
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.homework import Homework
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
    upload_homework_attachment,
)
from app.storage import read_file

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


@router.post("/homework/{homework_id}/attachment", response_model=HomeworkOut)
async def upload_homework_attachment_endpoint(
    homework_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.edit"))
):
    content = await file.read()
    return upload_homework_attachment(db, tenant_id=user.tenant_id, homework_id=homework_id, file_name=file.filename or "attachment", content=content)


@router.get("/homework/{homework_id}/attachment")
def get_homework_attachment_endpoint(
    homework_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("homework.view"))
) -> Response:
    homework = db.get(Homework, homework_id)
    if homework is None or homework.tenant_id != user.tenant_id or homework.attachment_path is None:
        raise AppError(ErrorCode.NOT_FOUND, "No attachment for this homework.", status_code=404)
    content = read_file(homework.attachment_path)
    media_type = mimetypes.guess_type(homework.attachment_file_name or "")[0] or "application/octet-stream"
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{homework.attachment_file_name}"'})
