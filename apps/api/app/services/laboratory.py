"""Laboratory sample lifecycle (industry #25): the real state machine
behind Register -> Accession -> Accept/Reject -> Result entry ->
Validate -> Authorize -> Report, plus the QC subsystem (blanks/
controls/duplicates), worksheets (batch testing), CSV-based instrument
result import, and storage/chain-of-custody tracking built on top of
it -- see app.models.laboratory's module docstring for what's real
here versus named, deferred gaps (live ASTM/HL7 protocol, aliquot
genealogy, etc.).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.laboratory import (
    CUSTODY_EVENT_TYPES,
    QC_TYPES,
    RESULT_TYPES,
    SAMPLE_PRIORITIES,
    STORAGE_LOCATION_TYPES,
    LabCustodyEvent,
    LabInstrument,
    LabReport,
    LabResult,
    LabSample,
    LabStorageLocation,
    LabTestDefinition,
    LabTestOrder,
    LabWorksheet,
    QcReferenceSample,
    QcRun,
)
from app.services.numbering import next_document_number


def _require_status(sample: LabSample, expected: str) -> None:
    if sample.status != expected:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Sample {sample.sample_number} is '{sample.status}', not '{expected}'.",
            status_code=409,
            details={"sample_id": str(sample.id), "current_status": sample.status, "expected_status": expected},
        )


def register_sample(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    client_id: uuid.UUID,
    sample_type_id: uuid.UUID,
    container_id: uuid.UUID | None,
    priority: str,
    collection_datetime: datetime | None,
    notes: str | None,
    test_definition_ids: list[uuid.UUID],
) -> LabSample:
    if not test_definition_ids:
        raise AppError(ErrorCode.VALIDATION_ERROR, "A sample must be registered with at least one test.")
    if priority not in SAMPLE_PRIORITIES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"priority must be one of {SAMPLE_PRIORITIES}, got {priority!r}.")

    sample_number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="lab_sample", default_prefix="LAB",
    )
    sample = LabSample(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, sample_number=sample_number,
        client_id=client_id, sample_type_id=sample_type_id, container_id=container_id, priority=priority,
        status="registered", collection_datetime=collection_datetime, notes=notes,
    )
    db.add(sample)
    db.flush()

    now = datetime.now(timezone.utc)
    for test_definition_id in test_definition_ids:
        test_def = db.get(LabTestDefinition, test_definition_id)
        if test_def is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown test definition {test_definition_id}.", status_code=422)
        db.add(LabTestOrder(tenant_id=tenant_id, sample_id=sample.id, test_definition_id=test_definition_id, status="ordered", ordered_at=now))
    db.flush()
    return sample


def accession_sample(db: Session, *, sample_id: uuid.UUID) -> LabSample:
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    _require_status(sample, "registered")
    sample.status = "accessioned"
    if sample.received_datetime is None:
        sample.received_datetime = datetime.now(timezone.utc)
    db.flush()
    return sample


def accept_sample(db: Session, *, sample_id: uuid.UUID) -> LabSample:
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    _require_status(sample, "accessioned")
    sample.status = "accepted"
    db.flush()
    return sample


def reject_sample(db: Session, *, sample_id: uuid.UUID, reason: str) -> LabSample:
    if not reason or not reason.strip():
        raise AppError(ErrorCode.VALIDATION_ERROR, "A rejection reason is required.")
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    _require_status(sample, "accessioned")
    sample.status = "rejected"
    sample.rejection_reason = reason
    db.flush()
    return sample


def _compute_flag(test_def: LabTestDefinition, numeric_value: Decimal | None) -> str | None:
    if numeric_value is None:
        return None
    if test_def.critical_low is not None and numeric_value < test_def.critical_low:
        return "critical"
    if test_def.critical_high is not None and numeric_value > test_def.critical_high:
        return "critical"
    if test_def.reference_range_low is not None and numeric_value < test_def.reference_range_low:
        return "abnormal"
    if test_def.reference_range_high is not None and numeric_value > test_def.reference_range_high:
        return "abnormal"
    if test_def.reference_range_low is not None or test_def.reference_range_high is not None:
        return "normal"
    return None


def enter_result(db: Session, *, test_order_id: uuid.UUID, result_value: str, user_id: uuid.UUID) -> LabResult:
    test_order = db.get(LabTestOrder, test_order_id)
    if test_order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Test order not found.", status_code=404)
    sample = db.get(LabSample, test_order.sample_id)
    if sample.status not in ("accepted", "in_process"):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Sample {sample.sample_number} must be accepted before results can be entered (currently '{sample.status}').",
            status_code=409,
        )
    test_def = db.get(LabTestDefinition, test_order.test_definition_id)

    numeric_value = None
    if test_def.result_type == "quantitative":
        try:
            numeric_value = Decimal(result_value)
        except Exception as exc:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"'{result_value}' is not a valid numeric result for {test_def.name}.") from exc

    existing = db.execute(select(LabResult).where(LabResult.test_order_id == test_order_id)).scalar_one_or_none()
    flag = _compute_flag(test_def, numeric_value)
    now = datetime.now(timezone.utc)
    if existing is not None:
        if existing.status != "draft":
            raise AppError(ErrorCode.VALIDATION_ERROR, "This result has already been validated -- it cannot be overwritten in place.", status_code=409)
        existing.result_value = result_value
        existing.numeric_value = numeric_value
        existing.unit = test_def.unit
        existing.flag = flag
        existing.entered_by_user_id = user_id
        existing.entered_at = now
        result = existing
    else:
        result = LabResult(
            tenant_id=sample.tenant_id, test_order_id=test_order_id, result_value=result_value, numeric_value=numeric_value,
            unit=test_def.unit, flag=flag, status="draft", entered_by_user_id=user_id, entered_at=now,
        )
        db.add(result)

    test_order.status = "in_progress"
    if sample.status == "accepted":
        sample.status = "in_process"
    db.flush()
    return result


def validate_result(db: Session, *, result_id: uuid.UUID, user_id: uuid.UUID) -> LabResult:
    result = db.get(LabResult, result_id)
    if result is None:
        raise AppError(ErrorCode.NOT_FOUND, "Result not found.", status_code=404)
    if result.status != "draft":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Result is '{result.status}', not 'draft'.", status_code=409)
    result.status = "validated"
    result.validated_by_user_id = user_id
    result.validated_at = datetime.now(timezone.utc)
    db.flush()
    return result


def _latest_qc_status(db: Session, *, test_definition_id: uuid.UUID, worksheet_id: uuid.UUID | None) -> str | None:
    """None = no QC run has ever been recorded in the relevant scope
    (not a block -- a lab that hasn't configured QC for it yet isn't
    bricked). Otherwise the status of the single most recent run, of
    any type.

    When the test order belongs to a worksheet, QC is scoped to *that
    worksheet's own runs* -- the real, spec-intended batch scoping
    (sec67). When it doesn't (the walking-skeleton path, still fully
    supported), this falls back to the most recent run for the test
    definition as a whole regardless of worksheet, exactly as the
    pre-worksheet QC pass behaved.
    """
    stmt = select(QcRun.status).where(QcRun.test_definition_id == test_definition_id)
    if worksheet_id is not None:
        stmt = stmt.where(QcRun.worksheet_id == worksheet_id)
    latest = db.execute(stmt.order_by(QcRun.performed_at.desc()).limit(1)).scalar_one_or_none()
    return latest


def authorize_result(db: Session, *, result_id: uuid.UUID, user_id: uuid.UUID) -> LabResult:
    """spec sec46 segregation of duties, enforced for real: the person
    who entered a result may not be the one who authorizes it. This is
    a real check, not a compliant electronic signature (sec36) -- no
    re-authentication step exists here, named as a later gap."""
    result = db.get(LabResult, result_id)
    if result is None:
        raise AppError(ErrorCode.NOT_FOUND, "Result not found.", status_code=404)
    if result.status != "validated":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Result is '{result.status}', not 'validated'.", status_code=409)
    if result.entered_by_user_id == user_id:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "The analyst who entered this result cannot also authorize it.",
            status_code=409,
            details={"result_id": str(result.id)},
        )

    test_order_for_qc = db.get(LabTestOrder, result.test_order_id)
    qc_status = _latest_qc_status(db, test_definition_id=test_order_for_qc.test_definition_id, worksheet_id=test_order_for_qc.worksheet_id)
    if qc_status == "fail":
        scope_msg = "this worksheet's" if test_order_for_qc.worksheet_id is not None else "this test's"
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"The most recent QC run failed for {scope_msg} scope -- record a passing QC run before authorizing results for it.",
            status_code=409,
            details={"test_definition_id": str(test_order_for_qc.test_definition_id), "worksheet_id": str(test_order_for_qc.worksheet_id) if test_order_for_qc.worksheet_id else None},
        )

    result.status = "authorized"
    result.authorized_by_user_id = user_id
    result.authorized_at = datetime.now(timezone.utc)

    test_order = db.get(LabTestOrder, result.test_order_id)
    test_order.status = "completed"
    db.flush()

    sample = db.get(LabSample, test_order.sample_id)
    all_orders = db.execute(select(LabTestOrder).where(LabTestOrder.sample_id == sample.id)).scalars().all()
    if all(o.status == "completed" for o in all_orders):
        sample.status = "completed"
    db.flush()
    return result


def generate_report(
    db: Session, *, sample_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, financial_year_id: uuid.UUID, user_id: uuid.UUID,
) -> LabReport:
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    _require_status(sample, "completed")

    report_number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="lab_report", default_prefix="LABRPT",
    )
    report = LabReport(
        tenant_id=sample.tenant_id, sample_id=sample.id, report_number=report_number, version=1, status="released",
        generated_at=datetime.now(timezone.utc), released_by_user_id=user_id,
    )
    db.add(report)
    sample.status = "reported"
    db.flush()
    return report


def supersede_report(db: Session, *, report_id: uuid.UUID, user_id: uuid.UUID) -> LabReport:
    """spec sec35: the released row is never mutated -- a new row is
    created and the old one is pointed at it."""
    old_report = db.get(LabReport, report_id)
    if old_report is None:
        raise AppError(ErrorCode.NOT_FOUND, "Report not found.", status_code=404)
    if old_report.status != "released":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Report is '{old_report.status}', not 'released'.", status_code=409)

    new_report = LabReport(
        tenant_id=old_report.tenant_id, sample_id=old_report.sample_id, report_number=old_report.report_number,
        version=old_report.version + 1, status="released", generated_at=datetime.now(timezone.utc), released_by_user_id=user_id,
    )
    db.add(new_report)
    db.flush()
    old_report.status = "superseded"
    old_report.superseded_by_report_id = new_report.id
    db.flush()
    return new_report


def create_qc_reference_sample(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    test_definition_id: uuid.UUID,
    qc_type: str,
    name: str,
    lot_number: str | None,
    expiry_date: date | None,
    expected_low: Decimal | None,
    expected_high: Decimal | None,
) -> QcReferenceSample:
    if qc_type not in ("blank", "control"):
        raise AppError(ErrorCode.VALIDATION_ERROR, f"qc_type must be 'blank' or 'control' (reference-sample-backed types of {QC_TYPES}), got {qc_type!r}.")
    reference = QcReferenceSample(
        tenant_id=tenant_id, company_id=company_id, test_definition_id=test_definition_id, qc_type=qc_type, name=name,
        lot_number=lot_number, expiry_date=expiry_date, expected_low=expected_low, expected_high=expected_high,
    )
    db.add(reference)
    db.flush()
    return reference


def _require_open_or_in_progress_worksheet_for_test(db: Session, *, worksheet_id: uuid.UUID | None, test_definition_id: uuid.UUID) -> None:
    """A QC run may be attached to a worksheet only while that worksheet
    is still open for work, and only for the worksheet's own test
    definition -- otherwise a QC run could silently gate the wrong
    batch."""
    if worksheet_id is None:
        return
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    if worksheet.status == "completed":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Worksheet {worksheet.worksheet_number} is already completed -- QC runs can no longer be added to it.", status_code=409)
    if worksheet.test_definition_id != test_definition_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This QC run's test does not match the worksheet's test definition.", status_code=422)


def record_reference_qc_run(
    db: Session, *, reference_sample_id: uuid.UUID, result_value: str, user_id: uuid.UUID, worksheet_id: uuid.UUID | None = None,
) -> QcRun:
    """Blanks and controls are structurally identical here: both are a
    result compared against a QcReferenceSample's own expected_low/
    expected_high. Which one this is is just the reference sample's own
    qc_type, copied onto the run. Optionally attached to a worksheet
    (see LabWorksheet) so it gates that worksheet's batch specifically."""
    reference = db.get(QcReferenceSample, reference_sample_id)
    if reference is None:
        raise AppError(ErrorCode.NOT_FOUND, "QC reference sample not found.", status_code=404)
    _require_open_or_in_progress_worksheet_for_test(db, worksheet_id=worksheet_id, test_definition_id=reference.test_definition_id)
    try:
        numeric_value = Decimal(result_value)
    except Exception as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"'{result_value}' is not a valid numeric QC result.") from exc

    status = "pass"
    if reference.expected_low is not None and numeric_value < reference.expected_low:
        status = "fail"
    if reference.expected_high is not None and numeric_value > reference.expected_high:
        status = "fail"

    run = QcRun(
        tenant_id=reference.tenant_id, test_definition_id=reference.test_definition_id, qc_type=reference.qc_type,
        reference_sample_id=reference.id, result_value=result_value, numeric_value=numeric_value, status=status,
        performed_by_user_id=user_id, performed_at=datetime.now(timezone.utc), worksheet_id=worksheet_id,
    )
    db.add(run)
    db.flush()
    return run


def record_duplicate_qc_run(
    db: Session, *, source_test_order_id: uuid.UUID, result_value: str, user_id: uuid.UUID, worksheet_id: uuid.UUID | None = None,
) -> QcRun:
    """Compares against the *original* result already recorded for the
    same test order via RPD (relative percent difference). Without a
    duplicate_rpd_limit_percent configured on the test, the run is still
    recorded (for the historical record) but always reads as "pass" --
    there is no threshold to fail it against, and inventing a default
    limit would be a fabricated acceptance criterion, not a real one.
    """
    source_order = db.get(LabTestOrder, source_test_order_id)
    if source_order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Test order not found.", status_code=404)
    original_result = db.execute(select(LabResult).where(LabResult.test_order_id == source_test_order_id)).scalar_one_or_none()
    if original_result is None or original_result.numeric_value is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "The original test order has no numeric result yet to duplicate against.")
    _require_open_or_in_progress_worksheet_for_test(db, worksheet_id=worksheet_id, test_definition_id=source_order.test_definition_id)

    try:
        duplicate_value = Decimal(result_value)
    except Exception as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"'{result_value}' is not a valid numeric QC result.") from exc

    original_value = original_result.numeric_value
    mean = (original_value + duplicate_value) / 2
    rpd_percent = (abs(original_value - duplicate_value) / mean * 100) if mean != 0 else Decimal("0")

    test_def = db.get(LabTestDefinition, source_order.test_definition_id)
    status = "pass"
    if test_def.duplicate_rpd_limit_percent is not None and rpd_percent > test_def.duplicate_rpd_limit_percent:
        status = "fail"

    run = QcRun(
        tenant_id=source_order.tenant_id, test_definition_id=source_order.test_definition_id, qc_type="duplicate",
        source_test_order_id=source_order.id, result_value=result_value, numeric_value=duplicate_value,
        rpd_percent=rpd_percent.quantize(Decimal("0.01")), status=status,
        performed_by_user_id=user_id, performed_at=datetime.now(timezone.utc), worksheet_id=worksheet_id,
    )
    db.add(run)
    db.flush()
    return run


def create_worksheet(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, financial_year_id: uuid.UUID,
    test_definition_id: uuid.UUID, analyst_user_id: uuid.UUID | None, created_by_user_id: uuid.UUID,
) -> LabWorksheet:
    worksheet_number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="lab_worksheet", default_prefix="WS",
    )
    worksheet = LabWorksheet(
        tenant_id=tenant_id, company_id=company_id, worksheet_number=worksheet_number, test_definition_id=test_definition_id,
        status="open", analyst_user_id=analyst_user_id, created_by_user_id=created_by_user_id,
    )
    db.add(worksheet)
    db.flush()
    return worksheet


def add_test_order_to_worksheet(db: Session, *, worksheet_id: uuid.UUID, test_order_id: uuid.UUID) -> LabTestOrder:
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    if worksheet.status == "completed":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Worksheet {worksheet.worksheet_number} is already completed.", status_code=409)

    test_order = db.get(LabTestOrder, test_order_id)
    if test_order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Test order not found.", status_code=404)
    if test_order.test_definition_id != worksheet.test_definition_id:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This test order's test does not match the worksheet's test definition.", status_code=422)
    if test_order.worksheet_id is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This test order is already on a worksheet.", status_code=409)
    if test_order.status != "ordered":
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Test order is '{test_order.status}' -- only test orders still awaiting a result can be added to a worksheet.",
            status_code=409,
        )

    test_order.worksheet_id = worksheet.id
    db.flush()
    return test_order


def remove_test_order_from_worksheet(db: Session, *, worksheet_id: uuid.UUID, test_order_id: uuid.UUID) -> LabTestOrder:
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    if worksheet.status == "completed":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Worksheet {worksheet.worksheet_number} is already completed.", status_code=409)

    test_order = db.get(LabTestOrder, test_order_id)
    if test_order is None or test_order.worksheet_id != worksheet.id:
        raise AppError(ErrorCode.NOT_FOUND, "That test order is not on this worksheet.", status_code=404)

    test_order.worksheet_id = None
    db.flush()
    return test_order


def start_worksheet(db: Session, *, worksheet_id: uuid.UUID) -> LabWorksheet:
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    if worksheet.status != "open":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Worksheet is '{worksheet.status}', not 'open'.", status_code=409)

    has_items = db.execute(select(LabTestOrder.id).where(LabTestOrder.worksheet_id == worksheet.id).limit(1)).scalar_one_or_none()
    if has_items is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Add at least one test order to the worksheet before starting it.", status_code=409)

    worksheet.status = "in_progress"
    db.flush()
    return worksheet


def complete_worksheet(db: Session, *, worksheet_id: uuid.UUID) -> LabWorksheet:
    """Completing a worksheet just closes the batch to further additions
    -- it does not itself validate or authorize the individual results,
    which remain their own per-result workflow. Requires every test
    order on the worksheet to have at least a result entered."""
    worksheet = db.get(LabWorksheet, worksheet_id)
    if worksheet is None:
        raise AppError(ErrorCode.NOT_FOUND, "Worksheet not found.", status_code=404)
    if worksheet.status != "in_progress":
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Worksheet is '{worksheet.status}', not 'in_progress'.", status_code=409)

    test_orders = db.execute(select(LabTestOrder).where(LabTestOrder.worksheet_id == worksheet.id)).scalars().all()
    not_yet_resulted = [o for o in test_orders if o.status == "ordered"]
    if not_yet_resulted:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"{len(not_yet_resulted)} test order(s) on this worksheet still have no result entered.",
            status_code=409,
            details={"pending_test_order_ids": [str(o.id) for o in not_yet_resulted]},
        )

    worksheet.status = "completed"
    worksheet.completed_at = datetime.now(timezone.utc)
    db.flush()
    return worksheet


def create_instrument(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, code: str, name: str, manufacturer: str | None, model: str | None,
) -> LabInstrument:
    instrument = LabInstrument(tenant_id=tenant_id, company_id=company_id, code=code, name=name, manufacturer=manufacturer, model=model)
    db.add(instrument)
    db.flush()
    return instrument


def import_instrument_results(
    db: Session, *, tenant_id: uuid.UUID, instrument_id: uuid.UUID, rows: list[dict], user_id: uuid.UUID,
) -> dict:
    """Each row is {"sample_number": str, "test_code": str,
    "result_value": str}. Matches against a pending (still 'ordered')
    test order for that sample + test code and calls the same
    enter_result() used by manual entry, tagging the result with this
    instrument. Every row gets a real per-row outcome -- a row that
    can't be matched is reported as an error, never silently dropped.
    """
    instrument = db.get(LabInstrument, instrument_id)
    if instrument is None:
        raise AppError(ErrorCode.NOT_FOUND, "Instrument not found.", status_code=404)

    outcomes = []
    for index, row in enumerate(rows):
        sample_number = (row.get("sample_number") or "").strip()
        test_code = (row.get("test_code") or "").strip()
        result_value = (row.get("result_value") or "").strip()
        if not sample_number or not test_code or not result_value:
            outcomes.append({"row": index, "status": "error", "message": "sample_number, test_code and result_value are all required.", "sample_number": sample_number, "test_code": test_code})
            continue

        sample = db.execute(select(LabSample).where(LabSample.tenant_id == tenant_id, LabSample.sample_number == sample_number)).scalar_one_or_none()
        if sample is None:
            outcomes.append({"row": index, "status": "error", "message": f"No sample numbered '{sample_number}'.", "sample_number": sample_number, "test_code": test_code})
            continue

        test_def = db.execute(select(LabTestDefinition).where(LabTestDefinition.tenant_id == tenant_id, LabTestDefinition.code == test_code)).scalar_one_or_none()
        if test_def is None:
            outcomes.append({"row": index, "status": "error", "message": f"No test definition coded '{test_code}'.", "sample_number": sample_number, "test_code": test_code})
            continue

        test_order = db.execute(
            select(LabTestOrder).where(LabTestOrder.sample_id == sample.id, LabTestOrder.test_definition_id == test_def.id, LabTestOrder.status == "ordered")
        ).scalar_one_or_none()
        if test_order is None:
            outcomes.append({"row": index, "status": "error", "message": f"No pending '{test_code}' test order on sample '{sample_number}' (already resulted, or never ordered).", "sample_number": sample_number, "test_code": test_code})
            continue

        try:
            result = enter_result(db, test_order_id=test_order.id, result_value=result_value, user_id=user_id)
        except AppError as exc:
            outcomes.append({"row": index, "status": "error", "message": exc.message, "sample_number": sample_number, "test_code": test_code})
            continue

        result.instrument_id = instrument.id
        db.flush()
        outcomes.append({"row": index, "status": "imported", "message": None, "sample_number": sample_number, "test_code": test_code, "result_id": str(result.id)})

    return {
        "instrument_id": str(instrument.id),
        "imported_count": sum(1 for o in outcomes if o["status"] == "imported"),
        "error_count": sum(1 for o in outcomes if o["status"] == "error"),
        "rows": outcomes,
    }


def create_storage_location(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, parent_location_id: uuid.UUID | None,
    code: str, name: str, location_type: str, temperature_c: Decimal | None,
) -> LabStorageLocation:
    if location_type not in STORAGE_LOCATION_TYPES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"location_type must be one of {STORAGE_LOCATION_TYPES}, got {location_type!r}.")
    if parent_location_id is not None and db.get(LabStorageLocation, parent_location_id) is None:
        raise AppError(ErrorCode.NOT_FOUND, "Parent storage location not found.", status_code=404)

    location = LabStorageLocation(
        tenant_id=tenant_id, company_id=company_id, parent_location_id=parent_location_id,
        code=code, name=name, location_type=location_type, temperature_c=temperature_c,
    )
    db.add(location)
    db.flush()
    return location


def _sample_is_disposed(db: Session, sample_id: uuid.UUID) -> bool:
    latest = db.execute(
        select(LabCustodyEvent.event_type).where(LabCustodyEvent.sample_id == sample_id).order_by(LabCustodyEvent.performed_at.desc()).limit(1)
    ).scalar_one_or_none()
    return latest == "disposed"


def record_custody_event(
    db: Session, *, sample_id: uuid.UUID, event_type: str, to_location_id: uuid.UUID | None, user_id: uuid.UUID, notes: str | None,
) -> LabCustodyEvent:
    """The append-only ledger entry point (see LabCustodyEvent's own
    docstring for why from_location_id is never caller-supplied). A
    disposed sample is a terminal state -- no further custody events
    can be recorded for it."""
    if event_type not in CUSTODY_EVENT_TYPES:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"event_type must be one of {CUSTODY_EVENT_TYPES}, got {event_type!r}.")
    sample = db.get(LabSample, sample_id)
    if sample is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sample not found.", status_code=404)
    if _sample_is_disposed(db, sample_id):
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Sample {sample.sample_number} has already been disposed -- no further custody events can be recorded.", status_code=409)

    if event_type in ("checked_out", "disposed"):
        if to_location_id is not None:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"'{event_type}' events do not target a location -- the sample is leaving tracked storage.")
    else:
        if to_location_id is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"'{event_type}' events require a to_location_id.")
        if db.get(LabStorageLocation, to_location_id) is None:
            raise AppError(ErrorCode.NOT_FOUND, "Storage location not found.", status_code=404)

    event = LabCustodyEvent(
        tenant_id=sample.tenant_id, sample_id=sample.id, event_type=event_type,
        from_location_id=sample.current_location_id, to_location_id=to_location_id,
        performed_by_user_id=user_id, performed_at=datetime.now(timezone.utc), notes=notes,
    )
    db.add(event)
    sample.current_location_id = to_location_id
    db.flush()
    return event
