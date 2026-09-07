import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db_tenant, require_permission
from app.errors import AppError, ErrorCode
from app.models.projects import Site
from app.models.sales import DeliveryChallan, Invoice, Quotation, Receipt, SalesOrder
from app.models.tenant import Company
from app.models.user import User
from app.schemas.sales import (
    ConvertToOrderRequest,
    DeliveryChallanOut,
    InvoiceOut,
    QuotationCreate,
    QuotationOut,
    ReceiptCreate,
    ReceiptOut,
    SalesOrderOut,
)
from app.services.dispatch import create_delivery_challan
from app.services.invoicing import create_invoice_from_challan
from app.services.numbering import get_current_financial_year
from app.services.quotation import create_quotation
from app.services.receipts import record_receipt
from app.services.sales_order import create_sales_order_from_quotation

router = APIRouter(tags=["sales"])


def _default_company(db: Session, tenant_id: uuid.UUID) -> Company:
    return db.execute(select(Company).where(Company.tenant_id == tenant_id)).scalars().first()


# ---------------------------------------------------------------- Quotations

@router.post("/quotations", response_model=QuotationOut, status_code=201)
def create_quotation_endpoint(
    payload: QuotationCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.create")),
) -> Quotation:
    company = _default_company(db, user.tenant_id)
    from app.models.tenant import Branch

    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    fy = get_current_financial_year(db, company.id)

    site_state = None
    if payload.site_id:
        site = db.get(Site, payload.site_id)
        site_state = site.state if site else None

    quotation = create_quotation(
        db,
        tenant_id=user.tenant_id,
        company_id=company.id,
        branch_id=branch.id,
        financial_year_id=fy.id,
        customer_id=payload.customer_id,
        project_id=payload.project_id,
        site_id=payload.site_id,
        site_state=site_state,
        valid_until=payload.valid_until,
        lines=[line.model_dump() for line in payload.lines],
    )
    db.refresh(quotation)
    return quotation


@router.get("/quotations", response_model=list[QuotationOut])
def list_quotations(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list[Quotation]:
    return db.execute(select(Quotation).order_by(Quotation.created_at.desc())).scalars().all()


@router.get("/quotations/{quotation_id}", response_model=QuotationOut)
def get_quotation(
    quotation_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> Quotation:
    quotation = db.get(Quotation, quotation_id)
    if quotation is None:
        raise AppError(ErrorCode.NOT_FOUND, "Quotation not found.", status_code=404)
    return quotation


@router.post("/quotations/{quotation_id}/approve", response_model=QuotationOut)
def approve_quotation(
    quotation_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.edit")),
) -> Quotation:
    quotation = db.get(Quotation, quotation_id)
    if quotation is None:
        raise AppError(ErrorCode.NOT_FOUND, "Quotation not found.", status_code=404)
    quotation.status = "approved"
    db.flush()
    return quotation


@router.post("/quotations/{quotation_id}/convert-to-order", response_model=SalesOrderOut)
def convert_to_order(
    quotation_id: uuid.UUID,
    payload: ConvertToOrderRequest,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.create")),
) -> SalesOrder:
    quotation = db.get(Quotation, quotation_id)
    if quotation is None:
        raise AppError(ErrorCode.NOT_FOUND, "Quotation not found.", status_code=404)
    if quotation.status != "approved":
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Only an approved quotation can become a sales order.",
            details={"current_status": quotation.status},
        )
    fy = get_current_financial_year(db, quotation.company_id)
    order = create_sales_order_from_quotation(
        db, tenant_id=user.tenant_id, quotation_id=quotation_id,
        warehouse_id=payload.warehouse_id, financial_year_id=fy.id,
    )
    db.refresh(order)
    return order


# ---------------------------------------------------------------- Sales orders

@router.get("/sales-orders", response_model=list[SalesOrderOut])
def list_sales_orders(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list[SalesOrder]:
    return db.execute(select(SalesOrder).order_by(SalesOrder.created_at.desc())).scalars().all()


@router.get("/sales-orders/{order_id}", response_model=SalesOrderOut)
def get_sales_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sales order not found.", status_code=404)
    return order


@router.post("/sales-orders/{order_id}/dispatch", response_model=DeliveryChallanOut)
def dispatch_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.edit")),
) -> DeliveryChallan:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sales order not found.", status_code=404)
    if order.status != "reserved":
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Only a reserved order can be dispatched.",
            details={"current_status": order.status},
        )
    fy = get_current_financial_year(db, order.company_id)
    challan = create_delivery_challan(
        db, tenant_id=user.tenant_id, sales_order_id=order_id, financial_year_id=fy.id, user_id=user.id,
    )
    return challan


@router.post("/sales-orders/{order_id}/invoice", response_model=InvoiceOut)
def invoice_order(
    order_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.edit")),
) -> Invoice:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Sales order not found.", status_code=404)
    challan = db.execute(
        select(DeliveryChallan).where(DeliveryChallan.sales_order_id == order_id).order_by(DeliveryChallan.created_at.desc())
    ).scalars().first()
    if challan is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This order has not been dispatched yet.")
    fy = get_current_financial_year(db, order.company_id)
    invoice = create_invoice_from_challan(
        db, tenant_id=user.tenant_id, delivery_challan_id=challan.id, financial_year_id=fy.id,
    )
    db.refresh(invoice)
    return invoice


# ---------------------------------------------------------------- Invoices & receipts

@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list[Invoice]:
    return db.execute(select(Invoice).order_by(Invoice.created_at.desc())).scalars().all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db_tenant),
    _user=Depends(require_permission("customers.view")),
) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise AppError(ErrorCode.NOT_FOUND, "Invoice not found.", status_code=404)
    return invoice


@router.post("/receipts", response_model=ReceiptOut, status_code=201)
def create_receipt(
    payload: ReceiptCreate,
    db: Session = Depends(get_db_tenant),
    user: User = Depends(require_permission("customers.edit")),
) -> Receipt:
    company = _default_company(db, user.tenant_id)
    from app.models.tenant import Branch

    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    fy = get_current_financial_year(db, company.id)

    receipt = record_receipt(
        db,
        tenant_id=user.tenant_id,
        company_id=company.id,
        branch_id=branch.id,
        financial_year_id=fy.id,
        customer_id=payload.customer_id,
        amount=payload.amount,
        mode=payload.mode,
        reference_note=payload.reference_note,
        invoice_id=payload.invoice_id,
    )
    return receipt


@router.get("/receipts", response_model=list[ReceiptOut])
def list_receipts(
    db: Session = Depends(get_db_tenant), _user=Depends(require_permission("customers.view"))
) -> list[Receipt]:
    return db.execute(select(Receipt).order_by(Receipt.created_at.desc())).scalars().all()
