import csv
import io
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_module, require_permission
from app.errors import AppError, ErrorCode
from app.models.laboratory import (
    RESULT_TYPES,
    LabContainer,
    LabCustodyEvent,
    LabInstrument,
    LabReport,
    LabResult,
    LabSample,
    LabSampleType,
    LabStorageLocation,
    LabTestDefinition,
    LabTestOrder,
    LabWorksheet,
    QcReferenceSample,
    QcRun,
)
from app.models.masters import Customer
from app.models.tenant import Branch, Company
from app.models.user import User
from app.schemas.laboratory import (
    CustodyEventCreate,
    CustodyEventOut,
    InstrumentImportResponse,
    LabContainerCreate,
    LabContainerOut,
    LabInstrumentCreate,
    LabInstrumentOut,
    LabRejectRequest,
    LabReportOut,
    LabResultEntry,
    LabResultOut,
    LabSampleCreate,
    LabSampleDetail,
    LabSampleOut,
    LabSampleTypeCreate,
    LabSampleTypeOut,
    LabStorageLocationCreate,
    LabStorageLocationOut,
    LabTestDefinitionCreate,
    LabTestDefinitionOut,
    LabTestOrderOut,
    QcDuplicateRunCreate,
    QcReferenceRunCreate,
    QcReferenceSampleCreate,
    QcReferenceSampleOut,
    QcRunOut,
    WorksheetAddTestOrder,
    WorksheetCreate,
    WorksheetDetail,
    WorksheetOut,
    WorksheetTestOrderOut,
)
from app.services.laboratory import (
    accept_sample,
    accession_sample,
    add_test_order_to_worksheet,
    authorize_result,
    complete_worksheet,
    create_instrument,
    create_qc_reference_sample,
    create_storage_location,
    create_worksheet,
    enter_result,
    generate_report,
    import_instrument_results,
    record_custody_event,
    record_duplicate_qc_run,
    record_reference_qc_run,
    register_sample,
    reject_sample,
    remove_test_order_from_worksheet,
    start_worksheet,
    supersede_report,
    validate_result,
)
from app.services.numbering import get_current_financial_year

router = APIRouter(prefix="/lab", tags=["laboratory"], dependencies=[Depends(require_module("laboratory"))])


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
    if payload.result_type not in RESULT_TYPES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"result_type must be one of {RESULT_TYPES}, got {payload.result_type!r}.")
    company, _ = _company_and_branch(db, user.tenant_id)
    test_def = LabTestDefinition(tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    db.add(test_def)
    db.flush()
    return test_def


# --------------------------------------------------------------- Samples

def _sample_out(db: Session, sample: LabSample) -> LabSampleOut:
    client = db.get(Customer, sample.client_id)
    location = db.get(LabStorageLocation, sample.current_location_id) if sample.current_location_id else None
    return LabSampleOut(
        id=sample.id, sample_number=sample.sample_number, client_id=sample.client_id,
        client_name=client.name if client else "", sample_type_id=sample.sample_type_id, container_id=sample.container_id,
        priority=sample.priority, status=sample.status, collection_datetime=sample.collection_datetime,
        received_datetime=sample.received_datetime, rejection_reason=sample.rejection_reason, notes=sample.notes,
        current_location_id=sample.current_location_id, current_location_name=location.name if location else None,
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


# -------------------------------------------------------------------- QC

@router.get("/qc-reference-samples", response_model=list[QcReferenceSampleOut])
def list_qc_reference_samples(
    test_definition_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[QcReferenceSample]:
    stmt = select(QcReferenceSample).where(QcReferenceSample.is_active == True).order_by(QcReferenceSample.name)  # noqa: E712
    if test_definition_id:
        stmt = stmt.where(QcReferenceSample.test_definition_id == test_definition_id)
    return db.execute(stmt).scalars().all()


@router.post("/qc-reference-samples", response_model=QcReferenceSampleOut, status_code=201)
def create_qc_reference_sample_endpoint(
    payload: QcReferenceSampleCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> QcReferenceSample:
    company, _ = _company_and_branch(db, user.tenant_id)
    return create_qc_reference_sample(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.get("/qc-runs", response_model=list[QcRunOut])
def list_qc_runs(
    test_definition_id: uuid.UUID | None = None, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[QcRun]:
    stmt = select(QcRun).order_by(QcRun.performed_at.desc())
    if test_definition_id:
        stmt = stmt.where(QcRun.test_definition_id == test_definition_id)
    return db.execute(stmt).scalars().all()


@router.post("/qc-runs/reference", response_model=QcRunOut, status_code=201)
def record_reference_qc_run_endpoint(
    payload: QcReferenceRunCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> QcRun:
    return record_reference_qc_run(
        db, reference_sample_id=payload.reference_sample_id, result_value=payload.result_value, user_id=user.id, worksheet_id=payload.worksheet_id,
    )


@router.post("/qc-runs/duplicate", response_model=QcRunOut, status_code=201)
def record_duplicate_qc_run_endpoint(
    payload: QcDuplicateRunCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> QcRun:
    return record_duplicate_qc_run(
        db, source_test_order_id=payload.source_test_order_id, result_value=payload.result_value, user_id=user.id, worksheet_id=payload.worksheet_id,
    )


# ----------------------------------------------------------------- Worksheets

def _worksheet_out(db: Session, worksheet: LabWorksheet) -> WorksheetOut:
    test_def = db.get(LabTestDefinition, worksheet.test_definition_id)
    return WorksheetOut(
        id=worksheet.id, worksheet_number=worksheet.worksheet_number, test_definition_id=worksheet.test_definition_id,
        test_name=test_def.name if test_def else "", status=worksheet.status, analyst_user_id=worksheet.analyst_user_id,
        created_by_user_id=worksheet.created_by_user_id, completed_at=worksheet.completed_at, created_at=worksheet.created_at,
    )


def _worksheet_detail(db: Session, worksheet: LabWorksheet) -> WorksheetDetail:
    base = _worksheet_out(db, worksheet)
    test_orders = db.execute(select(LabTestOrder).where(LabTestOrder.worksheet_id == worksheet.id).order_by(LabTestOrder.ordered_at)).scalars().all()
    order_outs = []
    for order in test_orders:
        sample = db.get(LabSample, order.sample_id)
        client = db.get(Customer, sample.client_id) if sample else None
        order_outs.append(
            WorksheetTestOrderOut(
                id=order.id, test_definition_id=order.test_definition_id, test_name=base.test_name, status=order.status,
                ordered_at=order.ordered_at, sample_id=order.sample_id, sample_number=sample.sample_number if sample else "",
                client_name=client.name if client else "", worksheet_id=order.worksheet_id,
            )
        )
    qc_runs = db.execute(select(QcRun).where(QcRun.worksheet_id == worksheet.id).order_by(QcRun.performed_at.desc())).scalars().all()
    return WorksheetDetail(**base.model_dump(), test_orders=order_outs, qc_runs=[QcRunOut.model_validate(r) for r in qc_runs])


@router.get("/worksheets", response_model=list[WorksheetOut])
def list_worksheets(
    status: str | None = None, test_definition_id: uuid.UUID | None = None,
    db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[WorksheetOut]:
    stmt = select(LabWorksheet).order_by(LabWorksheet.created_at.desc())
    if status:
        stmt = stmt.where(LabWorksheet.status == status)
    if test_definition_id:
        stmt = stmt.where(LabWorksheet.test_definition_id == test_definition_id)
    worksheets = db.execute(stmt).scalars().all()
    return [_worksheet_out(db, w) for w in worksheets]


@router.post("/worksheets", response_model=WorksheetOut, status_code=201)
def create_worksheet_endpoint(
    payload: WorksheetCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> WorksheetOut:
    company, branch = _company_and_branch(db, user.tenant_id)
    fy = get_current_financial_year(db, company.id)
    worksheet = create_worksheet(
        db, tenant_id=user.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        test_definition_id=payload.test_definition_id, analyst_user_id=payload.analyst_user_id, created_by_user_id=user.id,
    )
    return _worksheet_out(db, worksheet)


def _get_worksheet_or_404(db: Session, worksheet_id: uuid.UUID) -> LabWorksheet:
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    return worksheet


@router.get("/worksheets/{worksheet_id}", response_model=WorksheetDetail)
def get_worksheet(worksheet_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> WorksheetDetail:
    return _worksheet_detail(db, _get_worksheet_or_404(db, worksheet_id))


@router.post("/worksheets/{worksheet_id}/test-orders", response_model=WorksheetDetail, status_code=201)
def add_test_order_to_worksheet_endpoint(
    worksheet_id: uuid.UUID, payload: WorksheetAddTestOrder, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> WorksheetDetail:
    add_test_order_to_worksheet(db, worksheet_id=worksheet_id, test_order_id=payload.test_order_id)
    return _worksheet_detail(db, _get_worksheet_or_404(db, worksheet_id))


@router.delete("/worksheets/{worksheet_id}/test-orders/{test_order_id}", response_model=WorksheetDetail)
def remove_test_order_from_worksheet_endpoint(
    worksheet_id: uuid.UUID, test_order_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> WorksheetDetail:
    remove_test_order_from_worksheet(db, worksheet_id=worksheet_id, test_order_id=test_order_id)
    return _worksheet_detail(db, _get_worksheet_or_404(db, worksheet_id))


@router.post("/worksheets/{worksheet_id}/start", response_model=WorksheetDetail)
def start_worksheet_endpoint(worksheet_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit"))) -> WorksheetDetail:
    start_worksheet(db, worksheet_id=worksheet_id)
    return _worksheet_detail(db, _get_worksheet_or_404(db, worksheet_id))


@router.post("/worksheets/{worksheet_id}/complete", response_model=WorksheetDetail)
def complete_worksheet_endpoint(worksheet_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.approve"))) -> WorksheetDetail:
    complete_worksheet(db, worksheet_id=worksheet_id)
    return _worksheet_detail(db, _get_worksheet_or_404(db, worksheet_id))


@router.get("/test-orders/unassigned", response_model=list[WorksheetTestOrderOut])
def list_unassigned_test_orders(
    test_definition_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[WorksheetTestOrderOut]:
    """Powers the worksheet-builder UI: test orders for this test
    definition that are still awaiting a result and aren't already on
    another worksheet."""
    test_def = db.get(LabTestDefinition, test_definition_id)
    test_name = test_def.name if test_def else ""
    stmt = (
        select(LabTestOrder)
        .where(LabTestOrder.test_definition_id == test_definition_id, LabTestOrder.status == "ordered", LabTestOrder.worksheet_id.is_(None))
        .order_by(LabTestOrder.ordered_at)
    )
    orders = db.execute(stmt).scalars().all()
    out = []
    for order in orders:
        sample = db.get(LabSample, order.sample_id)
        client = db.get(Customer, sample.client_id) if sample else None
        out.append(
            WorksheetTestOrderOut(
                id=order.id, test_definition_id=order.test_definition_id, test_name=test_name, status=order.status,
                ordered_at=order.ordered_at, sample_id=order.sample_id, sample_number=sample.sample_number if sample else "",
                client_name=client.name if client else "", worksheet_id=order.worksheet_id,
            )
        )
    return out


# ----------------------------------------------------------------- Instruments

@router.get("/instruments", response_model=list[LabInstrumentOut])
def list_instruments(db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabInstrument]:
    return db.execute(select(LabInstrument).where(LabInstrument.is_active == True).order_by(LabInstrument.name)).scalars().all()  # noqa: E712


@router.post("/instruments", response_model=LabInstrumentOut, status_code=201)
def create_instrument_endpoint(
    payload: LabInstrumentCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabInstrument:
    company, _ = _company_and_branch(db, user.tenant_id)
    return create_instrument(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())


@router.post("/instruments/{instrument_id}/import-results", response_model=InstrumentImportResponse)
async def import_instrument_results_endpoint(
    instrument_id: uuid.UUID, file: UploadFile = File(...), db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> InstrumentImportResponse:
    """A real CSV import, not a staged multi-step wizard -- instrument
    export files are small and map 1:1 onto pending test orders, so
    each row is matched and committed in the same request. Expects
    columns sample_number, test_code, result_value (see ADR-021's
    instruments addendum for why this stops short of a live ASTM/HL2
    protocol)."""
    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, "The uploaded file is not valid UTF-8 text.") from exc

    reader = csv.DictReader(io.StringIO(text))
    missing = {"sample_number", "test_code", "result_value"} - set(reader.fieldnames or [])
    if missing:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"CSV is missing required column(s): {', '.join(sorted(missing))}.")

    rows = [dict(row) for row in reader]
    return import_instrument_results(db, tenant_id=user.tenant_id, instrument_id=instrument_id, rows=rows, user_id=user.id)


# ------------------------------------------------------- Storage & custody

def _storage_location_out(db: Session, location: LabStorageLocation) -> LabStorageLocationOut:
    parent = db.get(LabStorageLocation, location.parent_location_id) if location.parent_location_id else None
    return LabStorageLocationOut(
        id=location.id, parent_location_id=location.parent_location_id, parent_name=parent.name if parent else None,
        code=location.code, name=location.name, location_type=location.location_type,
        temperature_c=location.temperature_c, is_active=location.is_active,
    )


@router.get("/storage-locations", response_model=list[LabStorageLocationOut])
def list_storage_locations(db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view"))) -> list[LabStorageLocationOut]:
    locations = db.execute(select(LabStorageLocation).where(LabStorageLocation.is_active == True).order_by(LabStorageLocation.name)).scalars().all()  # noqa: E712
    return [_storage_location_out(db, l) for l in locations]


@router.post("/storage-locations", response_model=LabStorageLocationOut, status_code=201)
def create_storage_location_endpoint(
    payload: LabStorageLocationCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.create")),
) -> LabStorageLocationOut:
    company, _ = _company_and_branch(db, user.tenant_id)
    location = create_storage_location(db, tenant_id=user.tenant_id, company_id=company.id, **payload.model_dump())
    return _storage_location_out(db, location)


def _custody_event_out(db: Session, event: LabCustodyEvent) -> CustodyEventOut:
    from_loc = db.get(LabStorageLocation, event.from_location_id) if event.from_location_id else None
    to_loc = db.get(LabStorageLocation, event.to_location_id) if event.to_location_id else None
    return CustodyEventOut(
        id=event.id, sample_id=event.sample_id, event_type=event.event_type,
        from_location_id=event.from_location_id, from_location_name=from_loc.name if from_loc else None,
        to_location_id=event.to_location_id, to_location_name=to_loc.name if to_loc else None,
        performed_by_user_id=event.performed_by_user_id, performed_at=event.performed_at, notes=event.notes,
    )


@router.get("/samples/{sample_id}/custody-events", response_model=list[CustodyEventOut])
def list_custody_events(
    sample_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user: User = Depends(require_permission("laboratory.view")),
) -> list[CustodyEventOut]:
    _get_sample_or_404(db, sample_id)
    events = db.execute(select(LabCustodyEvent).where(LabCustodyEvent.sample_id == sample_id).order_by(LabCustodyEvent.performed_at.desc())).scalars().all()
    return [_custody_event_out(db, e) for e in events]


@router.post("/samples/{sample_id}/custody-events", response_model=CustodyEventOut, status_code=201)
def record_custody_event_endpoint(
    sample_id: uuid.UUID, payload: CustodyEventCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("laboratory.edit")),
) -> CustodyEventOut:
    event = record_custody_event(db, sample_id=sample_id, user_id=user.id, **payload.model_dump())
    return _custody_event_out(db, event)
