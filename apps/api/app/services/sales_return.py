"""dev.md §48. Scope: reverses stock and posts a reversing journal entry
against the original invoice's tax split. Does not (yet) generate a
formal GST credit note document -- see warehouse_ops.SalesReturn's
docstring; that belongs with Slice 4's compliance documents.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.accounting import JournalEntry, JournalLine
from app.models.masters import Item
from app.models.sales import Invoice, InvoiceItem
from app.models.warehouse_ops import SalesReturn, SalesReturnItem
from app.services.accounts import get_account
from app.services.inventory import apply_ledger_movement
from app.services.numbering import next_document_number


def create_sales_return(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    invoice_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    reason: str | None,
    lines: list[dict],  # [{invoice_item_id, qty}]
    user_id: uuid.UUID,
) -> SalesReturn:
    invoice = db.get(Invoice, invoice_id)
    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="SRET", default_prefix="SRET",
    )

    sales_return = SalesReturn(
        tenant_id=tenant_id, number=number, invoice_id=invoice_id, warehouse_id=warehouse_id,
        return_date=date.today(), reason=reason, total=Decimal("0"),
    )
    db.add(sales_return)
    db.flush()

    total = taxable_total = cgst_total = sgst_total = igst_total = Decimal("0")

    for line in lines:
        invoice_item = db.get(InvoiceItem, line["invoice_item_id"])
        qty = Decimal(str(line["qty"]))
        proportion = qty / invoice_item.qty

        line_total = (invoice_item.line_total * proportion).quantize(Decimal("0.01"))
        taxable = (invoice_item.taxable_value * proportion).quantize(Decimal("0.01"))
        cgst = (invoice_item.cgst_amount * proportion).quantize(Decimal("0.01"))
        sgst = (invoice_item.sgst_amount * proportion).quantize(Decimal("0.01"))
        igst = (invoice_item.igst_amount * proportion).quantize(Decimal("0.01"))

        db.add(
            SalesReturnItem(
                tenant_id=tenant_id, sales_return_id=sales_return.id, invoice_item_id=invoice_item.id,
                item_id=invoice_item.item_id, qty=qty, rate=invoice_item.rate, line_total=line_total,
            )
        )

        item = db.get(Item, invoice_item.item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=invoice_item.item_id,
            qty=qty, rate=item.standard_cost, movement_type="sales_return",
            reference_type="sales_return", reference_id=sales_return.id, user_id=user_id,
        )

        total += line_total
        taxable_total += taxable
        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst

    sales_return.total = total
    db.flush()

    _post_return_journal(
        db, tenant_id=tenant_id, sales_return=sales_return, company_id=company_id, branch_id=branch_id,
        taxable_total=taxable_total, cgst_total=cgst_total, sgst_total=sgst_total, igst_total=igst_total,
        customer_id=invoice.customer_id,
    )
    return sales_return


def _post_return_journal(
    db: Session, *, tenant_id, sales_return: SalesReturn, company_id, branch_id,
    taxable_total: Decimal, cgst_total: Decimal, sgst_total: Decimal, igst_total: Decimal, customer_id,
) -> None:
    ar = get_account(db, tenant_id=tenant_id, company_id=company_id, code="1100-AR")
    sales = get_account(db, tenant_id=tenant_id, company_id=company_id, code="4000-SALES")

    entry = JournalEntry(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, entry_date=sales_return.return_date,
        document_type="sales_return", document_id=sales_return.id, narration=f"Sales return {sales_return.number}",
    )
    db.add(entry)
    db.flush()

    def line(account_id, *, debit=Decimal("0"), credit=Decimal("0")):
        if debit == 0 and credit == 0:
            return
        db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=account_id, debit=debit, credit=credit, party_type="customer", party_id=customer_id))

    # Reverses the original invoice's postings: Sales goes down (debit),
    # AR goes down (credit) -- the customer owes less.
    line(sales.id, debit=taxable_total)
    if cgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="2100-OUTPUT-CGST").id, debit=cgst_total)
    if sgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="2110-OUTPUT-SGST").id, debit=sgst_total)
    if igst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="2120-OUTPUT-IGST").id, debit=igst_total)
    line(ar.id, credit=taxable_total + cgst_total + sgst_total + igst_total)

    db.flush()
