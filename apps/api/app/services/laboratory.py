"""Laboratory sample lifecycle (industry #25's walking skeleton): the
real state machine behind Register -> Accession -> Accept/Reject ->
Result entry -> Validate -> Authorize -> Report, scoped down per this
module's models docstring (no worksheets/QC/instruments/storage in
this pass).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.laboratory import (
    QC_TYPES,
    RESULT_TYPES,
    SAMPLE_PRIORITIES,
    LabReport,
    LabResult,
    LabSample,
    LabTestDefinition,
    LabTestOrder,
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


def _latest_qc_status_for_test(db: Session, *, test_definition_id: uuid.UUID) -> str | None:
    """None = no QC run has ever been recorded for this test (not a
    block -- a lab that hasn't configured QC for it yet isn't bricked).
    Otherwise the status of the single most recent run, of any type."""
    latest = db.execute(
        select(QcRun.status).where(QcRun.test_definition_id == test_definition_id).order_by(QcRun.performed_at.desc()).limit(1)
    ).scalar_one_or_none()
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
    qc_status = _latest_qc_status_for_test(db, test_definition_id=test_order_for_qc.test_definition_id)
    if qc_status == "fail":
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "This test's most recent QC run failed -- record a passing QC run before authorizing results for it.",
            status_code=409,
            details={"test_definition_id": str(test_order_for_qc.test_definition_id)},
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


def record_reference_qc_run(db: Session, *, reference_sample_id: uuid.UUID, result_value: str, user_id: uuid.UUID) -> QcRun:
    """Blanks and controls are structurally identical here: both are a
    result compared against a QcReferenceSample's own expected_low/
    expected_high. Which one this is is just the reference sample's own
    qc_type, copied onto the run."""
    reference = db.get(QcReferenceSample, reference_sample_id)
    if reference is None:
        raise AppError(ErrorCode.NOT_FOUND, "QC reference sample not found.", status_code=404)
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
        performed_by_user_id=user_id, performed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.flush()
    return run


def record_duplicate_qc_run(db: Session, *, source_test_order_id: uuid.UUID, result_value: str, user_id: uuid.UUID) -> QcRun:
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
        performed_by_user_id=user_id, performed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.flush()
    return run
