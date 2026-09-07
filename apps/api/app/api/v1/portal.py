import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, get_portal_customer
from app.models.masters import Customer
from app.models.sales import DeliveryChallan, Invoice, Quotation, Receipt, SalesOrder
from app.schemas.portal import PaymentIntimationCreate, PortalDocumentOut, StatementLineOut
from app.schemas.sales import DeliveryChallanOut, InvoiceOut, QuotationOut, ReceiptOut, SalesOrderOut
from app.services import portal as portal_service

router = APIRouter(prefix="/portal", tags=["portal"])


@router.get("/quotations", response_model=list[QuotationOut])
def list_quotations(
    db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> list[Quotation]:
    return portal_service.list_quotations(db, customer)


@router.get("/quotations/{quotation_id}", response_model=QuotationOut)
def get_quotation(
    quotation_id: uuid.UUID, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> Quotation:
    return portal_service.get_quotation(db, customer, quotation_id)


@router.post("/quotations/{quotation_id}/approve", response_model=QuotationOut)
def approve_quotation(
    quotation_id: uuid.UUID, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> Quotation:
    return portal_service.decide_quotation(db, customer, quotation_id, approve=True)


@router.post("/quotations/{quotation_id}/reject", response_model=QuotationOut)
def reject_quotation(
    quotation_id: uuid.UUID, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> Quotation:
    return portal_service.decide_quotation(db, customer, quotation_id, approve=False)


@router.get("/sales-orders", response_model=list[SalesOrderOut])
def list_sales_orders(
    db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> list[SalesOrder]:
    return portal_service.list_sales_orders(db, customer)


@router.get("/sales-orders/{sales_order_id}", response_model=SalesOrderOut)
def get_sales_order(
    sales_order_id: uuid.UUID, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> SalesOrder:
    return portal_service.get_sales_order(db, customer, sales_order_id)


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> list[Invoice]:
    return portal_service.list_invoices(db, customer)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: uuid.UUID, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> Invoice:
    return portal_service.get_invoice(db, customer, invoice_id)


@router.get("/deliveries", response_model=list[DeliveryChallanOut])
def list_deliveries(
    db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> list[DeliveryChallan]:
    return portal_service.list_deliveries(db, customer)


@router.get("/statement", response_model=list[StatementLineOut])
def get_statement(
    db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> list[portal_service.StatementLine]:
    return portal_service.get_statement(db, customer)


@router.post("/documents", response_model=PortalDocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    quotation_id: uuid.UUID | None = Form(None),
    sales_order_id: uuid.UUID | None = Form(None),
    db: Session = Depends(get_db_tenant),
    customer: Customer = Depends(get_portal_customer),
):
    content = await file.read()
    return portal_service.upload_po_document(
        db, customer, file_name=file.filename, content=content, quotation_id=quotation_id, sales_order_id=sales_order_id,
    )


@router.post("/payments", response_model=ReceiptOut, status_code=201)
def submit_payment(
    payload: PaymentIntimationCreate, db: Session = Depends(get_db_tenant), customer: Customer = Depends(get_portal_customer)
) -> Receipt:
    return portal_service.submit_payment_intimation(
        db, customer, amount=payload.amount, mode=payload.mode, reference_note=payload.reference_note,
        invoice_id=payload.invoice_id,
    )
