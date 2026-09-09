"""Serial/IMEI registry + RMA lifecycle (§8's Electronics/Mobile/
Computer Hardware domain logic). Additive to the quantity-based stock
ledger, not a replacement for it -- see models/serial.py's docstring.
"""
import uuid
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.serial import RmaRequest, SerialUnit
from app.services.numbering import next_document_number

RMA_VALID_TRANSITIONS: dict[str, set[str]] = {
    "requested": {"approved", "rejected"},
    "approved": {"in_repair", "rejected"},
    "in_repair": {"resolved", "rejected"},
    "resolved": set(),
    "rejected": set(),
}


def register_serial_unit(db: Session, *, tenant_id: uuid.UUID, data: dict) -> SerialUnit:
    unit = SerialUnit(tenant_id=tenant_id, status="in_stock", **data)
    db.add(unit)
    try:
        db.flush()
    except IntegrityError as exc:
        # Let the caller's own transaction boundary do the rollback
        # (get_db_tenant's, in a real request) -- rolling back here too
        # would double-rollback an already-invalid transaction.
        if "uq_serial_units_tenant_item_serial" in str(exc.orig):
            raise AppError(
                ErrorCode.VALIDATION_ERROR, f"Serial number {data['serial_number']!r} is already registered for this item.",
            ) from exc
        raise
    return unit


def create_rma_request(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, financial_year_id: uuid.UUID,
    serial_unit_id: uuid.UUID, customer_id: uuid.UUID, reason: str,
) -> RmaRequest:
    unit = db.get(SerialUnit, serial_unit_id)
    if unit is None:
        raise AppError(ErrorCode.NOT_FOUND, "Serial unit not found.", status_code=404)

    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="RMA", default_prefix="RMA",
    )
    rma = RmaRequest(
        tenant_id=tenant_id, number=number, serial_unit_id=serial_unit_id, customer_id=customer_id,
        reason=reason, status="requested", requested_date=date.today(),
    )
    db.add(rma)
    unit.status = "under_repair" if unit.status != "under_repair" else unit.status
    db.flush()
    return rma


def transition_rma(
    db: Session, *, rma_id: uuid.UUID, new_status: str, resolution: str | None = None, resolution_notes: str | None = None,
) -> RmaRequest:
    rma = db.get(RmaRequest, rma_id)
    if rma is None:
        raise AppError(ErrorCode.NOT_FOUND, "RMA request not found.", status_code=404)

    allowed = RMA_VALID_TRANSITIONS.get(rma.status, set())
    if new_status not in allowed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, f"Can't move an RMA from '{rma.status}' to '{new_status}'.",
            details={"current_status": rma.status, "requested_status": new_status, "allowed": sorted(allowed)},
        )

    rma.status = new_status
    if resolution:
        rma.resolution = resolution
    if resolution_notes:
        rma.resolution_notes = resolution_notes
    if new_status in ("resolved", "rejected"):
        rma.resolved_date = date.today()
        unit = db.get(SerialUnit, rma.serial_unit_id)
        if new_status == "resolved" and resolution in ("repaired",):
            unit.status = "in_stock"
        elif new_status == "resolved" and resolution == "replaced":
            unit.status = "scrapped"
        elif new_status == "rejected":
            unit.status = "sold"  # back with the customer, unresolved

    db.flush()
    return rma
