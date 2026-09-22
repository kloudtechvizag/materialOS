import mimetypes
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.announcements import Announcement
from app.models.tenant import Company
from app.models.user import User
from app.schemas.announcements import AnnouncementCreate, AnnouncementOut
from app.services.announcements import create_announcement, delete_announcement, list_announcements, upload_announcement_attachment
from app.storage import read_file

router = APIRouter(tags=["announcements"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


@router.get("/announcements", response_model=list[AnnouncementOut])
def list_announcements_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("announcements.view"))) -> list[Announcement]:
    return list_announcements(db, tenant_id=user.tenant_id)


@router.post("/announcements", response_model=AnnouncementOut, status_code=201)
def create_announcement_endpoint(
    payload: AnnouncementCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("announcements.create"))
) -> Announcement:
    company = _company(db, user.tenant_id)
    return create_announcement(db, tenant_id=user.tenant_id, company_id=company.id, published_by_user_id=user.id, **payload.model_dump())


@router.delete("/announcements/{announcement_id}", status_code=204)
def delete_announcement_endpoint(
    announcement_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("announcements.delete"))
) -> None:
    delete_announcement(db, tenant_id=user.tenant_id, announcement_id=announcement_id)


@router.post("/announcements/{announcement_id}/attachment", response_model=AnnouncementOut)
async def upload_announcement_attachment_endpoint(
    announcement_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("announcements.create"))
):
    content = await file.read()
    return upload_announcement_attachment(db, tenant_id=user.tenant_id, announcement_id=announcement_id, file_name=file.filename or "attachment", content=content)


@router.get("/announcements/{announcement_id}/attachment")
def get_announcement_attachment_endpoint(
    announcement_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("announcements.view"))
) -> Response:
    announcement = db.get(Announcement, announcement_id)
    if announcement is None or announcement.tenant_id != user.tenant_id or announcement.attachment_path is None:
        raise AppError(ErrorCode.NOT_FOUND, "No attachment for this announcement.", status_code=404)
    content = read_file(announcement.attachment_path)
    media_type = mimetypes.guess_type(announcement.attachment_file_name or "")[0] or "application/octet-stream"
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{announcement.attachment_file_name}"'})
