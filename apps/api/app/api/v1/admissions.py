import mimetypes
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.admissions import AdmissionApplication, AdmissionEnquiry
from app.models.tenant import Company
from app.models.user import User
from app.schemas.admissions import (
    AdmissionApplicationCreate,
    AdmissionApplicationOut,
    AdmissionApplicationUpdate,
    AdmissionConvertRequest,
    AdmissionDocumentOut,
    AdmissionEnquiryCreate,
    AdmissionEnquiryOut,
    AdmissionEnquiryUpdate,
)
from app.schemas.education import StudentOut
from app.services.admissions import (
    convert_application_to_student,
    create_application,
    create_enquiry,
    delete_admission_document,
    get_admission_document,
    list_admission_documents,
    transition_application,
    update_enquiry,
    upload_admission_document,
)
from app.storage import read_file

router = APIRouter(tags=["admissions"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


# ------------------------------------------------------------------ Enquiries

@router.get("/admission-enquiries", response_model=list[AdmissionEnquiryOut])
def list_enquiries(
    status: str | None = None, branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("admissions.view"))
) -> list[AdmissionEnquiry]:
    stmt = select(AdmissionEnquiry).order_by(AdmissionEnquiry.created_at.desc())
    if status:
        stmt = stmt.where(AdmissionEnquiry.status == status)
    if branch_id:
        stmt = stmt.where(AdmissionEnquiry.branch_id == branch_id)
    return db.execute(stmt).scalars().all()


@router.post("/admission-enquiries", response_model=AdmissionEnquiryOut, status_code=201)
def create_enquiry_endpoint(
    payload: AdmissionEnquiryCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.create"))
) -> AdmissionEnquiry:
    company = _company(db, user.tenant_id)
    return create_enquiry(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.patch("/admission-enquiries/{enquiry_id}", response_model=AdmissionEnquiryOut)
def update_enquiry_endpoint(
    enquiry_id: uuid.UUID, payload: AdmissionEnquiryUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit"))
) -> AdmissionEnquiry:
    return update_enquiry(db, tenant_id=user.tenant_id, enquiry_id=enquiry_id, **payload.model_dump())


# --------------------------------------------------------------- Applications

@router.get("/admission-applications", response_model=list[AdmissionApplicationOut])
def list_applications(
    status: str | None = None, branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("admissions.view"))
) -> list[AdmissionApplication]:
    stmt = select(AdmissionApplication).order_by(AdmissionApplication.created_at.desc())
    if status:
        stmt = stmt.where(AdmissionApplication.status == status)
    if branch_id:
        stmt = stmt.where(AdmissionApplication.branch_id == branch_id)
    return db.execute(stmt).scalars().all()


@router.get("/admission-applications/{application_id}", response_model=AdmissionApplicationOut)
def get_application(
    application_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("admissions.view"))
) -> AdmissionApplication:
    application = db.get(AdmissionApplication, application_id)
    if application is None:
        raise AppError(ErrorCode.NOT_FOUND, "Application not found.", status_code=404)
    return application


@router.post("/admission-applications", response_model=AdmissionApplicationOut, status_code=201)
def create_application_endpoint(
    payload: AdmissionApplicationCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.create"))
) -> AdmissionApplication:
    company = _company(db, user.tenant_id)
    return create_application(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.patch("/admission-applications/{application_id}", response_model=AdmissionApplicationOut)
def update_application(
    application_id: uuid.UUID, payload: AdmissionApplicationUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit"))
) -> AdmissionApplication:
    return transition_application(db, tenant_id=user.tenant_id, application_id=application_id, decided_by_user_id=user.id, **payload.model_dump())


@router.post("/admission-applications/{application_id}/convert", response_model=StudentOut, status_code=201)
def convert_application(
    application_id: uuid.UUID, payload: AdmissionConvertRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.approve"))
):
    company = _company(db, user.tenant_id)
    return convert_application_to_student(
        db, tenant_id=user.tenant_id, company_id=company.id, application_id=application_id, decided_by_user_id=user.id, **payload.model_dump()
    )


# -------------------------------------------------------------------- Documents

@router.get("/admission-applications/{application_id}/documents", response_model=list[AdmissionDocumentOut])
def list_documents_endpoint(
    application_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
):
    return list_admission_documents(db, tenant_id=user.tenant_id, application_id=application_id)


@router.post("/admission-applications/{application_id}/documents", response_model=AdmissionDocumentOut, status_code=201)
async def upload_document_endpoint(
    application_id: uuid.UUID, document_type: str = Form(...), file: UploadFile = File(...),
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit")),
):
    content = await file.read()
    return upload_admission_document(
        db, tenant_id=user.tenant_id, application_id=application_id, document_type=document_type,
        file_name=file.filename or "document", content=content,
    )


@router.get("/admission-applications/{application_id}/documents/{document_id}")
def download_document_endpoint(
    application_id: uuid.UUID, document_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> Response:
    document = get_admission_document(db, tenant_id=user.tenant_id, document_id=document_id)
    if document.application_id != application_id:
        raise AppError(ErrorCode.NOT_FOUND, "Document not found.", status_code=404)
    content = read_file(document.file_path)
    media_type = mimetypes.guess_type(document.file_name)[0] or "application/octet-stream"
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{document.file_name}"'})


@router.delete("/admission-applications/{application_id}/documents/{document_id}", status_code=204)
def delete_document_endpoint(
    application_id: uuid.UUID, document_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit"))
) -> None:
    document = get_admission_document(db, tenant_id=user.tenant_id, document_id=document_id)
    if document.application_id != application_id:
        raise AppError(ErrorCode.NOT_FOUND, "Document not found.", status_code=404)
    delete_admission_document(db, tenant_id=user.tenant_id, document_id=document_id)
