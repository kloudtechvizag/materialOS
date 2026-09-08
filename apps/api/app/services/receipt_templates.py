"""ADR-016: the receipt template engine's data half -- one function per
document type, all normalizing into the same `ReceiptData` shape
(schemas/receipts.py) so `components/receipts/ReceiptRenderer.tsx` on
the frontend is the only place a receipt is actually laid out. Adding
a new document type here is a new `_from_x()` function, never a new
receipt component -- that's the whole point of "don't hardcode receipt
layouts into individual modules."

Deliberately a separate module from services/receipts.py (which is an
unrelated, pre-existing service -- record_receipt(), the customer
payment-against-invoice flow used by Slice 3/6). Writing this file's
first draft as services/receipts.py overwrote that real, load-bearing
module entirely; caught immediately by main.py failing to import
(portal.py's `from app.services.receipts import record_receipt`), not
by careful review beforehand -- restored from git and moved here
under a name that can't collide with it again."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.audit import AuditLog
from app.models.masters import Customer, Item
from app.models.pos import WalkInSale
from app.models.receipts import ReceiptSettings
from app.models.sales import (
    DeliveryChallan,
    Invoice,
    InvoiceItem,
    PaymentAllocation,
    Quotation,
    Receipt,
    SalesOrder,
)
from app.models.tenant import Branch, Company
from app.models.user import User
from app.models.warehouse_ops import SalesReturn
from app.schemas.receipts import ReceiptData, ReceiptLineItem, ReceiptSettingsOut
from app.services.credit import compute_outstanding


def ensure_receipt_settings(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> ReceiptSettings:
    settings = db.execute(
        select(ReceiptSettings).where(ReceiptSettings.tenant_id == tenant_id, ReceiptSettings.company_id == company_id)
    ).scalar_one_or_none()
    if settings is None:
        settings = ReceiptSettings(tenant_id=tenant_id, company_id=company_id)
        db.add(settings)
        db.flush()
    return settings


def update_receipt_settings(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, **fields) -> ReceiptSettings:
    settings = ensure_receipt_settings(db, tenant_id=tenant_id, company_id=company_id)
    for field, value in fields.items():
        if value is not None:
            setattr(settings, field, value)
    db.flush()
    return settings


def _creator_name(db: Session, *, tenant_id: uuid.UUID, table_name: str, row_id: uuid.UUID) -> str | None:
    """Cashier/salesperson attribution -- neither WalkInSale, Invoice,
    nor Receipt store a creator column of their own, but the audit
    trigger (ADR-013, B12) has captured who inserted every row since
    Slice 0. Reusing that instead of adding a redundant column to four
    separate core Slice 1 tables."""
    log = db.execute(
        select(AuditLog).where(
            AuditLog.tenant_id == tenant_id, AuditLog.table_name == table_name,
            AuditLog.row_id == row_id, AuditLog.action == "INSERT",
        )
    ).scalar_one_or_none()
    if log is None or log.changed_by_user_id is None:
        return None
    user = db.get(User, log.changed_by_user_id)
    return user.full_name if user else None


def _company_address(company: Company) -> str | None:
    parts = [p for p in [company.address_line1, company.address_line2, company.city, company.state, company.pincode] if p]
    return ", ".join(parts) if parts else None


def _item_lines(db: Session, item_ids: list[uuid.UUID], *, show_sku: bool) -> dict[uuid.UUID, tuple[str, str | None]]:
    items = db.execute(select(Item).where(Item.id.in_(item_ids))).scalars().all() if item_ids else []
    return {i.id: (i.name, i.sku if show_sku else None) for i in items}


def _base(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID,
    document_type: str, document_number: str, occurred_at: datetime,
    customer_id: uuid.UUID | None, place_of_supply: str | None,
) -> tuple[ReceiptData, ReceiptSettings, Customer | None]:
    company = db.get(Company, company_id)
    branch = db.get(Branch, branch_id)
    settings = ensure_receipt_settings(db, tenant_id=tenant_id, company_id=company_id)
    customer = db.get(Customer, customer_id) if customer_id else None

    data = ReceiptData(
        document_type=document_type, document_number=document_number,
        document_date=occurred_at.date().isoformat(), document_time=occurred_at.strftime("%H:%M"),
        company_name=company.name, company_legal_name=company.legal_name, company_gstin=company.gstin,
        company_phone=company.phone, company_email=company.email, company_address=_company_address(company),
        branch_name=branch.name, branch_gstin=branch.gstin,
        customer_id=customer.id if customer else None,
        customer_name=customer.name if customer else None,
        customer_phone=customer.phone if customer else None,
        customer_gstin=customer.gstin if customer else None,
        place_of_supply=place_of_supply,
        items=[], subtotal=Decimal("0"), grand_total=Decimal("0"),
        settings=ReceiptSettingsOut.model_validate(settings),
    )
    return data, settings, customer


def _from_invoice(db: Session, *, tenant_id: uuid.UUID, invoice: Invoice, document_type: str = "invoice") -> ReceiptData:
    data, settings, customer = _base(
        db, tenant_id=tenant_id, company_id=invoice.company_id, branch_id=invoice.branch_id,
        document_type=document_type, document_number=invoice.number,
        occurred_at=datetime.combine(invoice.invoice_date, datetime.min.time(), tzinfo=timezone.utc),
        customer_id=invoice.customer_id, place_of_supply=invoice.place_of_supply_state,
    )
    item_names = _item_lines(db, [i.item_id for i in invoice.items], show_sku=settings.show_sku)
    data.items = [
        ReceiptLineItem(
            name=item_names.get(li.item_id, ("Item", None))[0], sku=item_names.get(li.item_id, ("Item", None))[1],
            qty=li.qty, uom=li.uom, rate=li.rate, tax_rate=li.cgst_rate + li.sgst_rate + li.igst_rate, line_total=li.line_total,
        )
        for li in invoice.items
    ]
    data.subtotal = invoice.subtotal
    data.cgst_amount = sum((li.cgst_amount for li in invoice.items), Decimal("0"))
    data.sgst_amount = sum((li.sgst_amount for li in invoice.items), Decimal("0"))
    data.igst_amount = sum((li.igst_amount for li in invoice.items), Decimal("0"))
    data.round_off = invoice.round_off
    data.grand_total = invoice.total
    data.balance_due = compute_outstanding(db, invoice.customer_id) if customer else None
    data.customer_credit_balance = data.balance_due
    if settings.show_cashier:
        data.cashier_name = _creator_name(db, tenant_id=tenant_id, table_name="invoices", row_id=invoice.id)
    return data


def _from_walk_in_sale(db: Session, *, tenant_id: uuid.UUID, sale: WalkInSale) -> ReceiptData:
    invoice = db.get(Invoice, sale.invoice_id)
    data = _from_invoice(db, tenant_id=tenant_id, invoice=invoice, document_type="pos_receipt")
    methods = []
    if sale.cash_amount:
        methods.append(f"Cash ₹{sale.cash_amount}")
    if sale.upi_amount:
        methods.append(f"UPI ₹{sale.upi_amount}")
    if sale.card_amount:
        methods.append(f"Card ₹{sale.card_amount}")
    data.payment_method = " + ".join(methods) if methods else None
    data.amount_paid = sale.cash_amount + sale.upi_amount + sale.card_amount
    data.change_due = sale.change_due
    if data.settings.show_cashier:
        data.cashier_name = _creator_name(db, tenant_id=tenant_id, table_name="walk_in_sales", row_id=sale.id)
    return data


def _from_receipt(db: Session, *, tenant_id: uuid.UUID, receipt: Receipt) -> ReceiptData:
    data, settings, customer = _base(
        db, tenant_id=tenant_id, company_id=receipt.company_id, branch_id=receipt.branch_id,
        document_type="payment_receipt", document_number=receipt.number,
        occurred_at=datetime.combine(receipt.receipt_date, datetime.min.time(), tzinfo=timezone.utc),
        customer_id=receipt.customer_id, place_of_supply=None,
    )
    allocations = db.execute(select(PaymentAllocation).where(PaymentAllocation.receipt_id == receipt.id)).scalars().all()
    invoice_numbers = []
    for alloc in allocations:
        invoice = db.get(Invoice, alloc.invoice_id)
        if invoice:
            invoice_numbers.append(f"{invoice.number} (₹{alloc.amount})")
    data.items = [ReceiptLineItem(name=f"Payment against {', '.join(invoice_numbers) or 'account'}", qty=Decimal("1"), uom="PAYMENT", rate=receipt.amount, line_total=receipt.amount)]
    data.subtotal = receipt.amount
    data.grand_total = receipt.amount
    data.payment_method = receipt.mode.upper()
    data.amount_paid = receipt.amount
    data.notes = receipt.reference_note
    data.balance_due = compute_outstanding(db, receipt.customer_id) if customer else None
    data.customer_credit_balance = data.balance_due
    if settings.show_cashier:
        data.cashier_name = _creator_name(db, tenant_id=tenant_id, table_name="receipts", row_id=receipt.id)
    return data


def _from_quotation(db: Session, *, tenant_id: uuid.UUID, quotation: Quotation) -> ReceiptData:
    data, settings, _customer = _base(
        db, tenant_id=tenant_id, company_id=quotation.company_id, branch_id=quotation.branch_id,
        document_type="estimate", document_number=quotation.number,
        occurred_at=datetime.combine(quotation.quote_date, datetime.min.time(), tzinfo=timezone.utc),
        customer_id=quotation.customer_id, place_of_supply=None,
    )
    item_names = _item_lines(db, [i.item_id for i in quotation.items], show_sku=settings.show_sku)
    data.items = [
        ReceiptLineItem(
            name=item_names.get(li.item_id, ("Item", None))[0], sku=item_names.get(li.item_id, ("Item", None))[1],
            qty=li.qty, uom=li.uom, rate=li.rate, tax_rate=li.gst_rate, line_total=li.line_total,
        )
        for li in quotation.items
    ]
    data.subtotal = quotation.subtotal
    data.igst_amount = quotation.tax_total  # quotations don't split CGST/SGST vs IGST (pre-place-of-supply); shown as one tax line
    data.grand_total = quotation.total
    data.notes = f"Valid until {quotation.valid_until.isoformat()}" if quotation.valid_until else None
    return data


def _from_delivery_challan(db: Session, *, tenant_id: uuid.UUID, challan: DeliveryChallan) -> ReceiptData:
    order = db.get(SalesOrder, challan.sales_order_id)
    data, settings, _customer = _base(
        db, tenant_id=tenant_id, company_id=challan.company_id, branch_id=challan.branch_id,
        document_type="delivery_receipt", document_number=challan.number,
        occurred_at=datetime.combine(challan.dispatch_date, datetime.min.time(), tzinfo=timezone.utc),
        customer_id=order.customer_id if order else None, place_of_supply=None,
    )
    item_names = _item_lines(db, [i.item_id for i in challan.items], show_sku=settings.show_sku)
    data.items = [
        ReceiptLineItem(
            name=item_names.get(li.item_id, ("Item", None))[0], sku=item_names.get(li.item_id, ("Item", None))[1],
            qty=li.qty, uom="", rate=Decimal("0"), line_total=Decimal("0"),
        )
        for li in challan.items
    ]
    data.notes = f"Sales order: {order.number}" if order else None
    return data


def _from_sales_return(db: Session, *, tenant_id: uuid.UUID, sales_return: SalesReturn) -> ReceiptData:
    invoice = db.get(Invoice, sales_return.invoice_id)
    data, settings, _customer = _base(
        db, tenant_id=tenant_id, company_id=invoice.company_id, branch_id=invoice.branch_id,
        document_type="credit_note", document_number=sales_return.number,
        occurred_at=datetime.combine(sales_return.return_date, datetime.min.time(), tzinfo=timezone.utc),
        customer_id=invoice.customer_id, place_of_supply=invoice.place_of_supply_state,
    )
    item_names_by_invoice_item = {ii.id: ii for ii in db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).scalars().all()}
    item_ids = [ii.item_id for ii in item_names_by_invoice_item.values()]
    item_names = _item_lines(db, item_ids, show_sku=settings.show_sku)
    data.items = [
        ReceiptLineItem(
            name=item_names.get(item_names_by_invoice_item[li.invoice_item_id].item_id, ("Item", None))[0],
            sku=item_names.get(item_names_by_invoice_item[li.invoice_item_id].item_id, ("Item", None))[1],
            qty=li.qty, uom=item_names_by_invoice_item[li.invoice_item_id].uom,
            rate=item_names_by_invoice_item[li.invoice_item_id].rate, line_total=item_names_by_invoice_item[li.invoice_item_id].rate * li.qty,
        )
        for li in sales_return.items
    ]
    data.subtotal = sales_return.total
    data.grand_total = sales_return.total
    data.notes = f"Reason: {sales_return.reason}" if sales_return.reason else f"Against invoice {invoice.number}"
    return data


_DOCUMENT_LOADERS = {
    "invoice": (Invoice, _from_invoice),
    "pos_receipt": (WalkInSale, _from_walk_in_sale),
    "payment_receipt": (Receipt, _from_receipt),
    "estimate": (Quotation, _from_quotation),
    "delivery_receipt": (DeliveryChallan, _from_delivery_challan),
    "credit_note": (SalesReturn, _from_sales_return),
}


def get_receipt_data(db: Session, *, tenant_id: uuid.UUID, document_type: str, document_id: uuid.UUID) -> ReceiptData:
    loader = _DOCUMENT_LOADERS.get(document_type)
    if loader is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown receipt document type: {document_type!r}")
    model, assembler = loader
    document = db.get(model, document_id)
    if document is None or document.tenant_id != tenant_id:
        raise AppError(ErrorCode.NOT_FOUND, f"{document_type} not found.", status_code=404)
    kwarg_name = {
        Invoice: "invoice", WalkInSale: "sale", Receipt: "receipt",
        Quotation: "quotation", DeliveryChallan: "challan", SalesReturn: "sales_return",
    }[model]
    return assembler(db, tenant_id=tenant_id, **{kwarg_name: document})
