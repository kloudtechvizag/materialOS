"""Retail profile counter sale. Deliberately reuses the same
Invoice/InvoiceItem/journal/receipt machinery the quotation-driven flow
uses (price_line, resolve_tax via price_line, _post_invoice_journal,
record_receipt) rather than a parallel posting path -- see
models/pos.py's docstring and ADR-010. The only genuinely new logic
here is: a walk-in sale has no quotation/sales-order/challan to derive
from, settles in full immediately (no partial payment), and deducts
stock directly instead of through the reserve-then-fulfil lifecycle
(reserve_stock/fulfill_reservation exist for the multi-step dispatch
flow; forcing an instant counter sale through that lifecycle would add
a reservation row that's created and fulfilled in the same transaction
for no benefit).
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.inventory import StockBalance, StockReservation
from app.models.masters import Customer, Item
from app.models.pos import WalkInSale
from app.models.sales import Invoice, InvoiceItem
from app.models.tenant import Company
from app.services.inventory import apply_ledger_movement
from app.services.invoicing import _post_invoice_journal
from app.services.money import round_invoice_total
from app.services.numbering import next_document_number
from app.services.receipts import record_receipt
from app.services.sales_common import price_line, resolve_place_of_supply

WALKIN_CUSTOMER_NAME = "Walk-in Customer"


def get_or_create_walkin_customer(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID) -> Customer:
    """Retail sales without a named customer still need a real
    Customer row -- Invoice.customer_id is not nullable (every other
    module: Customer 360, credit checks, receivables ageing, assumes a
    real customer). One synthetic, zero-credit-limit customer per
    company, created lazily on first use."""
    existing = db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.company_id == company_id, Customer.name == WALKIN_CUSTOMER_NAME)
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    customer = Customer(
        tenant_id=tenant_id, company_id=company_id, name=WALKIN_CUSTOMER_NAME,
        credit_limit=Decimal("0"), credit_days=0, is_active=True,
    )
    db.add(customer)
    db.flush()
    return customer


def _check_and_deduct_stock(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    item_id: uuid.UUID,
    qty: Decimal,
    rate: Decimal,
    invoice_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    # Same advisory-lock + available-stock formula as reserve_stock
    # (B4) -- not reused directly because that function's reservation
    # row belongs to the multi-step reserve-then-fulfil lifecycle a
    # counter sale doesn't have.
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": f"{warehouse_id}:{item_id}"})
    on_hand = db.execute(
        select(StockBalance.qty_on_hand).where(
            StockBalance.tenant_id == tenant_id, StockBalance.warehouse_id == warehouse_id, StockBalance.item_id == item_id
        )
    ).scalar_one_or_none() or Decimal("0")
    reserved = db.execute(
        select(func.coalesce(func.sum(StockReservation.qty), 0)).where(
            StockReservation.tenant_id == tenant_id,
            StockReservation.warehouse_id == warehouse_id,
            StockReservation.item_id == item_id,
            StockReservation.status == "active",
        )
    ).scalar_one()
    available = on_hand - Decimal(reserved)
    if available < qty:
        raise AppError(
            ErrorCode.INSUFFICIENT_STOCK,
            f"Only {available} available; {qty} requested.",
            status_code=409,
            details={"available": str(available), "requested": str(qty)},
        )
    apply_ledger_movement(
        db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=item_id, qty=-qty, rate=rate,
        movement_type="sale", reference_type="invoice", reference_id=invoice_id, user_id=user_id,
        occurred_at=datetime.now(timezone.utc),
    )


class WalkInSaleLine:
    def __init__(self, item_id: uuid.UUID, qty: Decimal, uom: str) -> None:
        self.item_id = item_id
        self.qty = qty
        self.uom = uom


def create_walk_in_sale(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    user_id: uuid.UUID,
    customer_id: uuid.UUID | None,
    lines: list[WalkInSaleLine],
    cash_amount: Decimal,
    upi_amount: Decimal,
    card_amount: Decimal,
    tendered_amount: Decimal,
) -> WalkInSale:
    if not lines:
        raise AppError(ErrorCode.VALIDATION_ERROR, "A sale needs at least one line.")

    company = db.get(Company, company_id)
    customer = db.get(Customer, customer_id) if customer_id else None
    if customer is None:
        customer = get_or_create_walkin_customer(db, tenant_id=tenant_id, company_id=company_id)

    today = date.today()
    place_of_supply = resolve_place_of_supply(site_state=None, customer=customer, company=company)

    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="INV", default_prefix="INV",
    )
    invoice = Invoice(
        tenant_id=tenant_id, number=number, company_id=company_id, branch_id=branch_id,
        customer_id=customer.id, project_id=None, sales_order_id=None, delivery_challan_id=None,
        invoice_date=today, place_of_supply_state=place_of_supply,
        subtotal=Decimal("0"), tax_total=Decimal("0"), total=Decimal("0"), status="posted",
    )
    db.add(invoice)
    db.flush()

    subtotal = cgst_total = sgst_total = igst_total = Decimal("0")
    for line in lines:
        item = db.get(Item, line.item_id)
        if item is None:
            raise AppError(ErrorCode.NOT_FOUND, f"Item {line.item_id} not found.", status_code=404)

        priced = price_line(
            db, item=item, qty=line.qty, uom=line.uom, customer=customer, company=company,
            project_id=None, site_state=None, as_of=today,
        )
        _check_and_deduct_stock(
            db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=item.id, qty=line.qty,
            rate=priced.unit_price, invoice_id=invoice.id, user_id=user_id,
        )
        db.add(
            InvoiceItem(
                tenant_id=tenant_id, invoice_id=invoice.id, item_id=item.id, qty=line.qty, uom=line.uom,
                rate=priced.unit_price, cost=item.standard_cost, taxable_value=priced.line_subtotal,
                cgst_rate=priced.tax.cgst_rate, sgst_rate=priced.tax.sgst_rate, igst_rate=priced.tax.igst_rate,
                cgst_amount=priced.tax.cgst_amount, sgst_amount=priced.tax.sgst_amount, igst_amount=priced.tax.igst_amount,
                line_total=priced.line_total,
            )
        )
        subtotal += priced.line_subtotal
        cgst_total += priced.tax.cgst_amount
        sgst_total += priced.tax.sgst_amount
        igst_total += priced.tax.igst_amount

    tax_total = cgst_total + sgst_total + igst_total
    rounded_total, round_off = round_invoice_total(subtotal + tax_total)
    invoice.subtotal = subtotal
    invoice.tax_total = tax_total
    invoice.round_off = round_off
    invoice.total = rounded_total
    db.flush()

    _post_invoice_journal(
        db, tenant_id=tenant_id, invoice=invoice, subtotal=subtotal,
        cgst_total=cgst_total, sgst_total=sgst_total, igst_total=igst_total, round_off=round_off,
    )

    total_applied = cash_amount + upi_amount + card_amount
    if total_applied != invoice.total:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Payment received ({total_applied}) does not match the invoice total ({invoice.total}).",
        )
    if cash_amount > 0 and tendered_amount < cash_amount:
        raise AppError(ErrorCode.VALIDATION_ERROR, "Tendered amount is less than the cash portion of the sale.")
    change_due = (tendered_amount - cash_amount) if cash_amount > 0 else Decimal("0")

    for mode, amount in (("cash", cash_amount), ("upi", upi_amount), ("card", card_amount)):
        if amount > 0:
            record_receipt(
                db, tenant_id=tenant_id, company_id=company_id, branch_id=branch_id,
                financial_year_id=financial_year_id, customer_id=customer.id, amount=amount,
                mode=mode, reference_note=f"POS {invoice.number}", invoice_id=invoice.id,
            )

    walk_in_sale = WalkInSale(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, warehouse_id=warehouse_id,
        invoice_id=invoice.id, customer_id=customer.id, cash_amount=cash_amount, upi_amount=upi_amount,
        card_amount=card_amount, tendered_amount=tendered_amount, change_due=change_due,
    )
    db.add(walk_in_sale)
    db.flush()
    return walk_in_sale
