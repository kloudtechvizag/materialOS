import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.laboratory import LabContainer, LabReport, LabResult, LabSample, LabSampleType, LabTestDefinition, LabTestOrder
from app.models.masters import Customer
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.laboratory import (
    LabContainerCreate,
    LabContainerOut,
    LabRejectRequest,
    LabReportOut,
    LabResultEntry,
    LabResultOut,
    LabSampleCreate,
    LabSampleDetail,
    LabSampleOut,
    LabSampleTypeCreate,
    LabSampleTypeOut,
    LabTestDefinitionCreate,
    LabTestDefinitionOut,
    LabTestOrderOut,
)
from app.services.laboratory import (
    accept_sample,
    accession_sample,
    authorize_result,
    enter_result,
    generate_report,
    register_sample,
    reject_sample,
    supersede_report,
    validate_result,
)
from app.services.numbering import get_current_financial_year

router = APIRouter(prefix="/lab", tags=["laboratory"])


def _company_and_branch(db: Session, tenant_id: uuid.UUID) -> tuple[Company, Branch]:
    company = db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    return company, branch


# --------------------------------------------------------------- Catalogs

@router.get("/sample-types", response_model=list[LabSampleTypeOut])
def list_sample_types(db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabSampleType]:
    return db.execute(select(LabSampleType).where(LabSampleType.is_active == True).order_by(LabSampleType.name)).scalars().all()  # noqa: E712


@router.post("/sample-types", response_model=LabSampleTypeOut, status_code=201)
def create_sample_type(
    payload: LabSampleTypeCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabSampleType:
    company, _ = _company_and_branch(db, user.tenant_id)
    sample_type = LabSampleType(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(sample_type)
    db.flush()
    return sample_type


@router.get("/containers", response_model=list[LabContainerOut])
def list_containers(db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabContainer]:
    return db.execute(select(LabContainer).where(LabContainer.is_active == True).order_by(LabContainer.name)).scalars().all()  # noqa: E712


@router.post("/containers", response_model=LabContainerOut, status_code=201)
def create_container(
    payload: LabContainerCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabContainer:
    company, _ = _company_and_branch(db, user.tenant_id)
    container = LabContainer(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(container)
    db.flush()
    return container


@router.get("/test-definitions", response_model=list[LabTestDefinitionOut])
def list_test_definitions(db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabTestDefinition]:
    return db.execute(select(LabTestDefinition).where(LabTestDefinition.is_active == True).order_by(LabTestDefinition.name)).scalars().all()  # noqa: E712


@router.post("/test-definitions", response_model=LabTestDefinitionOut, status_code=201)
def create_test_definition(
    payload: LabTestDefinitionCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabTestDefinition:
    company, _ = _company_and_branch(db, user.tenant_id)
    test_def = LabTestDefinition(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(test_def)
    db.flush()
    return test_def


# --------------------------------------------------------------- Samples

def _sample_out(db: Session, sample: LabSample) -> LabSampleOut:
    client = db.get(Customer, sample.client_id)
    return LabSampleOut(
        id=sample.id, sample_number=sample.sample_number, client_id=sample.client_id,
        client_name=client.name if client else "", sample_type_id=sample.sample_type_id, container_id=sample.container_id,
        priority=sample.priority, status=sample.status, collection_datetime=sample.collection_datetime,
        received_datetime=sample.received_datetime, rejection_reason=sample.rejection_reason, notes=sample.notes,
        created_at=sample.created_at,
    )


def _sample_detail(db: Session, sample: LabSample) -> LabSampleDetail:
    base = _sample_out(db, sample)
    test_orders = db.execute(select(LabTestOrder).where(LabTestOrder.sample_id == sample.id).order_by(LabTestOrder.ordered_at)).scalars().all()
    order_outs = []
    for order in test_orders:
        test_def = db.get(LabTestDefinition, order.test_definition_id)
        order_outs.append(LabTestOrderOut(id=order.id, test_definition_id=order.test_definition_id, test_name=test_def.name if test_def else "", status=order.status, ordered_at=order.ordered_at))
    results = (
        db.execute(select(LabResult).where(LabResult.test_order_id.in_([o.id for o in test_orders]))).scalars().all()
        if test_orders else []
    )
    return LabSampleDetail(**base.model_dump(), test_orders=order_outs, results=[LabResultOut.model_validate(r) for r in results])


@router.get("/samples", response_model=list[LabSampleOut])
def list_samples(
    status: str | None = None, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[LabSampleOut]:
    stmt = select(LabSample).order_by(LabSample.created_at.desc())
    if status:
        stmt = stmt.where(LabSample.status == status)
    samples = db.execute(stmt).scalars().all()
    return [_sample_out(db, s) for s in samples]


@router.post("/samples", response_model=LabSampleDetail, status_code=201)
def create_sample(
    payload: LabSampleCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabSampleDetail:
    company, branch = _company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    sample = register_sample(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        client_id=payload.client_id, sample_type_id=payload.sample_type_id, container_id=payload.container_id,
        priority=payload.priority, collection_datetime=payload.collection_datetime, notes=payload.notes,
        test_definition_ids=payload.test_definition_ids,
    )
    return _sample_detail(db, sample)


def _get_sample_or_404(db: Session, sample_id: uuid.UUID) -> LabSample:
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    return sample


@router.get("/samples/{sample_id}", response_model=LabSampleDetail)
def get_sample(sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> LabSampleDetail:
    sample = _get_sample_or_404(db, sample_id)
    return _sample_detail(db, sample)


@router.post("/samples/{sample_id}/accession", response_model=LabSampleDetail)
def accession_sample_endpoint(sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabSampleDetail:
    sample = accession_sample(db, sample_id=sample_id)
    return _sample_detail(db, sample)


@router.post("/samples/{sample_id}/accept", response_model=LabSampleDetail)
def accept_sample_endpoint(sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabSampleDetail:
    sample = accept_sample(db, sample_id=sample_id)
    return _sample_detail(db, sample)


@router.post("/samples/{sample_id}/reject", response_model=LabSampleDetail)
def reject_sample_endpoint(
    sample_id: uuid.UUID, payload: LabRejectRequest, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve")),
) -> LabSampleDetail:
    sample = reject_sample(db, sample_id=sample_id, reason=payload.reason)
    return _sample_detail(db, sample)


# ---------------------------------------------------------------- Results

@router.post("/test-orders/{test_order_id}/result", response_model=LabResultOut, status_code=201)
def enter_result_endpoint(
    test_order_id: uuid.UUID, payload: LabResultEntry, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> LabResult:
    return enter_result(db, test_order_id=test_order_id, result_value=payload.result_value, user_id=user.id)


@router.post("/results/{result_id}/validate", response_model=LabResultOut)
def validate_result_endpoint(result_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabResult:
    return validate_result(db, result_id=result_id, user_id=user.id)


@router.post("/results/{result_id}/authorize", response_model=LabResultOut)
def authorize_result_endpoint(result_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabResult:
    return authorize_result(db, result_id=result_id, user_id=user.id)


# ---------------------------------------------------------------- Reports

@router.post("/samples/{sample_id}/report", response_model=LabReportOut, status_code=201)
def generate_report_endpoint(sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabReport:
    company, branch = _company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    return generate_report(db, sample_id=sample_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id, user_id=user.id)


@router.get("/samples/{sample_id}/reports", response_model=list[LabReportOut])
def list_sample_reports(sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabReport]:
    return db.execute(select(LabReport).where(LabReport.sample_id == sample_id).order_by(LabReport.version)).scalars().all()


@router.post("/reports/{report_id}/supersede", response_model=LabReportOut, status_code=201)
def supersede_report_endpoint(report_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> LabReport:
    return supersede_report(db, report_id=report_id, user_id=user.id)
