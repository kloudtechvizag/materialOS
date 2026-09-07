import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.einvoice.service import cancel_irn, generate_irn
from app.errors import AppError, ErrorCode
from app.ewaybill.service import cancel_ewb, generate_ewb
from app.models.compliance import EInvoice, EWayBill
from app.models.user import User
from app.schemas.compliance import (
    EInvoiceCancelRequest,
    EInvoiceOut,
    EWayBillCancelRequest,
    EWayBillCreate,
    EWayBillOut,
)

router = APIRouter(tags=["compliance"])


@router.get("/invoices/{invoice_id}/e-invoice", response_model=EInvoiceOut)
def get_e_invoice(invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))) -> EInvoice:
    e_invoice = db.execute(select(EInvoice).where(EInvoice.invoice_id == invoice_id)).scalar_one_or_none()
    if e_invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "No e-invoice generated for this invoice yet.", status_code=404)
    return e_invoice


@router.post("/invoices/{invoice_id}/e-invoice", response_model=EInvoiceOut, status_code=201)
def create_e_invoice(invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("companies.edit"))) -> EInvoice:
    return generate_irn(db, tenant_id=user.tenant_id, invoice_id=invoice_id)


@router.post("/e-invoices/{e_invoice_id}/cancel", response_model=EInvoiceOut)
def cancel_e_invoice(e_invoice_id: uuid.UUID, payload: EInvoiceCancelRequest, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.edit"))) -> EInvoice:
    return cancel_irn(db, e_invoice_id=e_invoice_id, reason=payload.reason)


@router.get("/invoices/{invoice_id}/e-way-bill", response_model=EWayBillOut)
def get_e_way_bill(invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.view"))) -> EWayBill:
    ewb = db.execute(select(EWayBill).where(EWayBill.invoice_id == invoice_id)).scalar_one_or_none()
    if ewb is None:
        raise AppError(ErrorCode.NOT_FOUND, "No e-way bill generated for this invoice yet.", status_code=404)
    return ewb


@router.post("/invoices/{invoice_id}/e-way-bill", response_model=EWayBillOut, status_code=201)
def create_e_way_bill(
    invoice_id: uuid.UUID, payload: EWayBillCreate, db: Session = Depends(get_db_tenant), user: User = Depends(require_permission("companies.edit")),
) -> EWayBill:
    return generate_ewb(db, tenant_id=user.tenant_id, invoice_id=invoice_id, vehicle_number=payload.vehicle_number, distance_km=payload.distance_km)


@router.post("/e-way-bills/{ewb_id}/cancel", response_model=EWayBillOut)
def cancel_e_way_bill(ewb_id: uuid.UUID, payload: EWayBillCancelRequest, db: Session = Depends(get_db_tenant), _user=Depends(require_permission("companies.edit"))) -> EWayBill:
    return cancel_ewb(db, ewb_id=ewb_id, reason=payload.reason)
