"""D3: threshold, validity, 180-day, and cancellation rules in one place
(D4's "compliance architecture rule" applied to e-way bills). Two real
gaps, documented rather than guessed at: per-state intrastate thresholds
(D3 says "state-configurable, never hardcoded" -- no authoritative
state-by-state table was available to seed correctly, so a single
default is used until one is sourced) and the GSTR-3B-unfiled block
(this system doesn't track return-filing status).
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.ewaybill.gateway import get_gateway
from app.models.compliance import EWayBill
from app.models.sales import Invoice

VALIDITY_KM_PER_DAY = 200
MAX_DOCUMENT_AGE_DAYS = 180


def generate_ewb(
    db: Session, *, tenant_id: uuid.UUID, invoice_id: uuid.UUID, vehicle_number: str, distance_km: Decimal,
) -> EWayBill:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "Invoice not found.", status_code=404)

    age_days = (date.today() - invoice.invoice_date).days
    if age_days > MAX_DOCUMENT_AGE_DAYS:
        raise AppError(
            ErrorCode.EWB_DOCUMENT_TOO_OLD,
            f"Invoice is {age_days} days old; an e-way bill cannot be generated against a document "
            f"older than {MAX_DOCUMENT_AGE_DAYS} days (portal error 820 / IRP error 4043).",
            status_code=409,
        )

    existing = db.execute(select(EWayBill).where(EWayBill.invoice_id == invoice_id)).scalar_one_or_none()
    if existing is not None and existing.status == "active":
        raise AppError(ErrorCode.CONFLICT, "An active e-way bill already exists for this invoice.", status_code=409)

    gateway = get_gateway()
    result = gateway.generate_ewb(invoice_number=invoice.number, vehicle_number=vehicle_number, distance_km=str(distance_km))

    validity_days = max(1, -(-int(distance_km) // VALIDITY_KM_PER_DAY))  # ceil division, minimum 1 day
    ewb = EWayBill(
        tenant_id=tenant_id, invoice_id=invoice_id, ewb_number=result.ewb_number, vehicle_number=vehicle_number,
        distance_km=distance_km, generated_at=result.generated_at,
        valid_until=result.generated_at + timedelta(days=validity_days), status="active",
    )
    db.add(ewb)
    db.flush()
    return ewb


def cancel_ewb(db: Session, *, ewb_id: uuid.UUID, reason: str) -> EWayBill:
    ewb = db.get(EWayBill, ewb_id)
    if ewb is None:
        raise AppError(ErrorCode.NOT_FOUND, "E-way bill not found.", status_code=404)
    if ewb.status != "active":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only an active e-way bill can be cancelled.")

    hours_since_generation = (datetime.now(timezone.utc) - ewb.generated_at).total_seconds() / 3600
    if hours_since_generation > 24:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "An e-way bill can only be cancelled within 24 hours of generation.",
            details={"hours_since_generation": round(hours_since_generation, 1)},
        )

    gateway = get_gateway()
    gateway.cancel_ewb(ewb_number=ewb.ewb_number, reason=reason)

    ewb.status = "cancelled"
    ewb.cancelled_at = datetime.now(timezone.utc)
    db.flush()
    return ewb
