import mimetypes
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.admissions import AdmissionApplication, AdmissionEnquiry, AdmissionEnquiryActivity
from app.models.hr import Employee
from app.models.tenant import Company
from app.models.user import User
from app.schemas.admissions import (
    AdmissionApplicationCreate,
    AdmissionApplicationOut,
    AdmissionApplicationUpdate,
    AdmissionConvertRequest,
    AdmissionDocumentOut,
    AdmissionDuplicateCheckOut,
    AdmissionEnquiryActivityCreate,
    AdmissionEnquiryActivityOut,
    AdmissionEnquiryCreate,
    AdmissionEnquiryOut,
    AdmissionEnquiryUpdate,
    AdmissionsSummaryOut,
)
from app.schemas.education import StudentOut
from app.services.admissions import (
    convert_application_to_student,
    create_application,
    create_enquiry,
    delete_admission_document,
    find_duplicate_enquiries,
    get_admission_document,
    get_admissions_summary,
    list_admission_documents,
    list_enquiry_activities,
    log_enquiry_activity,
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


def _hydrate_enquiries(db: Session, tenant_id: uuid.UUID, enquiries: list[AdmissionEnquiry]) -> list[AdmissionEnquiry]:
    """Attaches the two derived, real display fields list/detail responses
    need: the assigned counsellor's name (a real Employee) and whether a
    real AdmissionApplication already exists for this enquiry -- neither
    is stored on AdmissionEnquiry itself."""
    if not enquiries:
        return enquiries
    employee_ids = {e.assigned_to_id for e in enquiries if e.assigned_to_id}
    employees = {}
    if employee_ids:
        for emp in db.execute(select(Employee).where(Employee.id.in_(employee_ids))).scalars().all():
            employees[emp.id] = f"{emp.first_name} {emp.last_name}".strip()
    enquiry_ids = {e.id for e in enquiries}
    applied_ids = set(
        db.execute(
            select(AdmissionApplication.enquiry_id).where(AdmissionApplication.tenant_id == tenant_id, AdmissionApplication.enquiry_id.in_(enquiry_ids))
        ).scalars().all()
    )
    for enquiry in enquiries:
        enquiry.assigned_to_name = employees.get(enquiry.assigned_to_id) if enquiry.assigned_to_id else None
        enquiry.has_application = enquiry.id in applied_ids
    return enquiries


# ------------------------------------------------------------------ Enquiries

@router.get("/admission-enquiries", response_model=list[AdmissionEnquiryOut])
def list_enquiries(
    status: str | None = None, branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> list[AdmissionEnquiry]:
    stmt = select(AdmissionEnquiry).order_by(AdmissionEnquiry.created_at.desc())
    if status:
        stmt = stmt.where(AdmissionEnquiry.status == status)
    if branch_id:
        stmt = stmt.where(AdmissionEnquiry.branch_id == branch_id)
    enquiries = db.execute(stmt).scalars().all()
    return _hydrate_enquiries(db, user.tenant_id, enquiries)


@router.get("/admission-enquiries/summary", response_model=AdmissionsSummaryOut)
def get_enquiries_summary(
    branch_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> dict:
    return get_admissions_summary(db, tenant_id=user.tenant_id, branch_id=branch_id)


@router.get("/admission-enquiries/duplicates", response_model=list[AdmissionDuplicateCheckOut])
def check_duplicate_enquiries(
    student_name: str | None = None, guardian_phone: str | None = None,
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> list[AdmissionEnquiry]:
    return find_duplicate_enquiries(db, tenant_id=user.tenant_id, student_name=student_name, guardian_phone=guardian_phone)


@router.post("/admission-enquiries", response_model=AdmissionEnquiryOut, status_code=201)
def create_enquiry_endpoint(
    payload: AdmissionEnquiryCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.create"))
) -> AdmissionEnquiry:
    company = _company(db, user.tenant_id)
    enquiry = create_enquiry(db, tenant_id=user.tenant_id, company_id=company.id, created_by_user_id=user.id, **payload.model_dump())
    return _hydrate_enquiries(db, user.tenant_id, [enquiry])[0]


@router.get("/admission-enquiries/{enquiry_id}", response_model=AdmissionEnquiryOut)
def get_enquiry(
    enquiry_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> AdmissionEnquiry:
    enquiry = db.get(AdmissionEnquiry, enquiry_id)
    if enquiry is None or enquiry.tenant_id != user.tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Enquiry not found.", status_code=404)
    return _hydrate_enquiries(db, user.tenant_id, [enquiry])[0]


@router.patch("/admission-enquiries/{enquiry_id}", response_model=AdmissionEnquiryOut)
def update_enquiry_endpoint(
    enquiry_id: uuid.UUID, payload: AdmissionEnquiryUpdate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit"))
) -> AdmissionEnquiry:
    enquiry = update_enquiry(db, tenant_id=user.tenant_id, enquiry_id=enquiry_id, changed_by_user_id=user.id, **payload.model_dump())
    return _hydrate_enquiries(db, user.tenant_id, [enquiry])[0]


@router.get("/admission-enquiries/{enquiry_id}/activities", response_model=list[AdmissionEnquiryActivityOut])
def list_enquiry_activities_endpoint(
    enquiry_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.view"))
) -> list[AdmissionEnquiryActivity]:
    enquiry = db.get(AdmissionEnquiry, enquiry_id)
    if enquiry is None or enquiry.tenant_id != user.tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Enquiry not found.", status_code=404)
    activities = list_enquiry_activities(db, tenant_id=user.tenant_id, enquiry_id=enquiry_id)
    user_ids = {a.created_by_user_id for a in activities if a.created_by_user_id}
    names = {}
    if user_ids:
        for u in db.execute(select(User).where(User.id.in_(user_ids))).scalars().all():
            names[u.id] = u.full_name or u.email
    for activity in activities:
        activity.created_by_name = names.get(activity.created_by_user_id)
    return activities


@router.post("/admission-enquiries/{enquiry_id}/activities", response_model=AdmissionEnquiryActivityOut, status_code=201)
def create_enquiry_activity_endpoint(
    enquiry_id: uuid.UUID, payload: AdmissionEnquiryActivityCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("admissions.edit"))
) -> AdmissionEnquiryActivity:
    enquiry = db.get(AdmissionEnquiry, enquiry_id)
    if enquiry is None or enquiry.tenant_id != user.tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, "Enquiry not found.", status_code=404)
    if payload.activity_type not in ("note", "call"):
        raise AppError(ErrorCode.VALIDATION_ERROR, "activity_type must be 'note' or 'call'.")
    activity = log_enquiry_activity(
        db, tenant_id=user.tenant_id, enquiry_id=enquiry_id, activity_type=payload.activity_type,
        description=payload.description, created_by_user_id=user.id,
    )
    activity.created_by_name = user.full_name or user.email
    return activity


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
    return create_application(db, tenant_id=user.tenant_id, company_id=company.id, created_by_user_id=user.id, **payload.model_dump())


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
