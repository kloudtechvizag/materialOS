import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.masters import Customer, Item
from app.models.projects import Site
from app.models.sales import (
    DeliveryChallan,
    DeliveryChallanItem,
    Invoice,
    InvoiceItem,
    SalesOrder,
    SalesOrderItem,
)
from app.models.tenant import Company
from app.services.accounts import get_account
from app.services.money import round_invoice_total
from app.services.numbering import next_document_number
from app.services.sales_common import resolve_place_of_supply
from app.tax.resolve import resolve_tax


def create_invoice_from_challan(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    delivery_challan_id: uuid.UUID,
    financial_year_id: uuid.UUID,
) -> Invoice:
    challan = db.get(DeliveryChallan, delivery_challan_id)
    order = db.get(SalesOrder, challan.sales_order_id)
    company = db.get(Company, order.company_id)
    customer = db.get(Customer, order.customer_id)
    site = db.get(Site, order.site_id) if order.site_id else None
    place_of_supply = resolve_place_of_supply(
        site_state=site.state if site else None, customer=customer, company=company
    )

    challan_items = db.execute(
        select(DeliveryChallanItem).where(DeliveryChallanItem.delivery_challan_id == challan.id)
    ).scalars().all()

    number = next_document_number(
        db,
        company_id=order.company_id,
        branch_id=order.branch_id,
        financial_year_id=financial_year_id,
        doc_type="INV",
        default_prefix="INV",
    )
    today = date.today()

    invoice = Invoice(
        tenant_id=tenant_id,
        number=number,
        company_id=order.company_id,
        branch_id=order.branch_id,
        customer_id=order.customer_id,
        project_id=order.project_id,
        sales_order_id=order.id,
        delivery_challan_id=challan.id,
        invoice_date=today,
        place_of_supply_state=place_of_supply,
        subtotal=Decimal("0"),
        tax_total=Decimal("0"),
        total=Decimal("0"),
        status="posted",
    )
    db.add(invoice)
    db.flush()

    subtotal = cgst_total = sgst_total = igst_total = Decimal("0")
    for ci in challan_items:
        soi = db.get(SalesOrderItem, ci.sales_order_item_id)
        item = db.get(Item, ci.item_id)
        line_subtotal = ci.qty * soi.rate
        tax = resolve_tax(
            document_date=today,
            place_of_supply_state=place_of_supply,
            company_state=company.state or "",
            item=item,
            taxable_value=line_subtotal,
        )
        db.add(
            InvoiceItem(
                tenant_id=tenant_id,
                invoice_id=invoice.id,
                item_id=item.id,
                qty=ci.qty,
                uom=soi.uom,
                rate=soi.rate,
                cost=item.standard_cost,
                taxable_value=line_subtotal,
                cgst_rate=tax.cgst_rate,
                sgst_rate=tax.sgst_rate,
                igst_rate=tax.igst_rate,
                cgst_amount=tax.cgst_amount,
                sgst_amount=tax.sgst_amount,
                igst_amount=tax.igst_amount,
                line_total=line_subtotal + tax.total_tax,
            )
        )
        subtotal += line_subtotal
        cgst_total += tax.cgst_amount
        sgst_total += tax.sgst_amount
        igst_total += tax.igst_amount

    tax_total = cgst_total + sgst_total + igst_total
    rounded_total, round_off = round_invoice_total(subtotal + tax_total)

    invoice.subtotal = subtotal
    invoice.tax_total = tax_total
    invoice.round_off = round_off
    invoice.total = rounded_total
    db.flush()

    _post_invoice_journal(
        db,
        tenant_id=tenant_id,
        invoice=invoice,
        subtotal=subtotal,
        cgst_total=cgst_total,
        sgst_total=sgst_total,
        igst_total=igst_total,
        round_off=round_off,
    )

    order.status = "invoiced"
    db.flush()
    return invoice


def _post_invoice_journal(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    invoice: Invoice,
    subtotal: Decimal,
    cgst_total: Decimal,
    sgst_total: Decimal,
    igst_total: Decimal,
    round_off: Decimal,
) -> None:
    """B6: posted in the same transaction as the invoice rows above.
    B5: debits must equal credits -- enforced again by the DB trigger
    regardless of whether this arithmetic is right.
    """
    from app.models.accounting import JournalEntry, JournalLine

    ar = get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="1100-AR")
    sales = get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="4000-SALES")
    round_off_acct = get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="4900-ROUNDOFF")

    entry = JournalEntry(
        tenant_id=tenant_id,
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
        entry_date=invoice.invoice_date,
        document_type="invoice",
        document_id=invoice.id,
        narration=f"Invoice {invoice.number}",
    )
    db.add(entry)
    db.flush()

    def line(account_id: uuid.UUID, *, debit: Decimal = Decimal("0"), credit: Decimal = Decimal("0")) -> None:
        if debit == 0 and credit == 0:
            return
        db.add(
            JournalLine(
                tenant_id=tenant_id,
                journal_entry_id=entry.id,
                account_id=account_id,
                debit=debit,
                credit=credit,
                party_type="customer",
                party_id=invoice.customer_id,
            )
        )

    line(ar.id, debit=invoice.total)
    line(sales.id, credit=subtotal)
    if cgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="2100-OUTPUT-CGST").id, credit=cgst_total)
    if sgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="2110-OUTPUT-SGST").id, credit=sgst_total)
    if igst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=invoice.company_id, code="2120-OUTPUT-IGST").id, credit=igst_total)

    # round_off > 0 means the rounded total is higher than the exact sum
    # -- that extra rupee is income, so it's a credit; negative is a debit.
    if round_off > 0:
        line(round_off_acct.id, credit=round_off)
    elif round_off < 0:
        line(round_off_acct.id, debit=-round_off)

    db.flush()
