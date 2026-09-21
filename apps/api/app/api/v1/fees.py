import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.fees import FeeHead
from app.models.tenant import Company
from app.models.user import User
from app.schemas.fees import (
    FeeHeadCreate,
    FeeHeadOut,
    FeeInvoiceOut,
    FeeStructureItemCreate,
    FeeStructureItemOut,
    GenerateFeeInvoicesRequest,
    GenerateFeeInvoicesResult,
)
from app.services.fees import (
    create_fee_head,
    create_fee_structure_item,
    generate_fee_invoices,
    get_student_fee_summary,
    list_fee_heads,
    list_fee_structure_items,
)

router = APIRouter(tags=["fees"], dependencies=[Depends(require_module("education"))])


def _company(db: Session, tenant_id: uuid.UUID) -> Company:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    if company is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "No company configured for this tenant.")
    return company


@router.get("/fee-heads", response_model=list[FeeHeadOut])
def list_fee_heads_endpoint(db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.view"))) -> list[FeeHead]:
    return list_fee_heads(db, tenant_id=user.tenant_id)


@router.post("/fee-heads", response_model=FeeHeadOut, status_code=201)
def create_fee_head_endpoint(
    payload: FeeHeadCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.create"))
) -> FeeHead:
    company = _company(db, user.tenant_id)
    return create_fee_head(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/fee-structure-items", response_model=list[FeeStructureItemOut])
def list_fee_structure_items_endpoint(
    academic_year_id: uuid.UUID, school_class_id: uuid.UUID | None = None,
    db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.view")),
):
    return list_fee_structure_items(db, tenant_id=user.tenant_id, academic_year_id=academic_year_id, school_class_id=school_class_id)


@router.post("/fee-structure-items", response_model=FeeStructureItemOut, status_code=201)
def create_fee_structure_item_endpoint(
    payload: FeeStructureItemCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.create"))
):
    return create_fee_structure_item(db, tenant_id=user.tenant_id, **payload.model_dump())


@router.post("/fee-invoices/generate", response_model=GenerateFeeInvoicesResult)
def generate_fee_invoices_endpoint(
    payload: GenerateFeeInvoicesRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.create"))
):
    company = _company(db, user.tenant_id)
    return generate_fee_invoices(db, tenant_id=user.tenant_id, company_id=company.id, user_id=user.id, **payload.model_dump())


@router.get("/students/{student_id}/fees", response_model=list[FeeInvoiceOut])
def student_fee_summary_endpoint(
    student_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("fees.view"))
):
    return get_student_fee_summary(db, tenant_id=user.tenant_id, student_id=student_id)
