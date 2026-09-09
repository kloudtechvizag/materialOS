"""Purchase-side mirror of services/sales_return.py: reverses the stock
ledger and the original purchase bill's journal postings. This is the
document a real GST debit note represents (goods sent back to a
supplier), printable via the receipt engine as "debit_note".
"""
import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.accounting import JournalEntry, JournalLine
from app.models.masters import Item
from app.models.procurement import PurchaseBill, PurchaseBillItem, PurchaseReturn, PurchaseReturnItem
from app.services.accounts import get_account
from app.services.inventory import apply_ledger_movement
from app.services.numbering import next_document_number


def create_purchase_return(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    purchase_bill_id: uuid.UUID,
    warehouse_id: uuid.UUID,
    reason: str | None,
    lines: list[dict],  # [{purchase_bill_item_id, qty}]
    user_id: uuid.UUID,
) -> PurchaseReturn:
    bill = db.get(PurchaseBill, purchase_bill_id)
    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="PRET", default_prefix="PRET",
    )

    purchase_return = PurchaseReturn(
        tenant_id=tenant_id, number=number, purchase_bill_id=purchase_bill_id, warehouse_id=warehouse_id,
        return_date=date.today(), reason=reason, total=Decimal("0"),
    )
    db.add(purchase_return)
    db.flush()

    total = taxable_total = cgst_total = sgst_total = igst_total = Decimal("0")

    for line in lines:
        bill_item = db.get(PurchaseBillItem, line["purchase_bill_item_id"])
        qty = Decimal(str(line["qty"]))
        proportion = qty / bill_item.qty

        line_total = (bill_item.line_total * proportion).quantize(Decimal("0.01"))
        taxable = (bill_item.taxable_value * proportion).quantize(Decimal("0.01"))
        cgst = (bill_item.cgst_amount * proportion).quantize(Decimal("0.01"))
        sgst = (bill_item.sgst_amount * proportion).quantize(Decimal("0.01"))
        igst = (bill_item.igst_amount * proportion).quantize(Decimal("0.01"))

        db.add(
            PurchaseReturnItem(
                tenant_id=tenant_id, purchase_return_id=purchase_return.id, purchase_bill_item_id=bill_item.id,
                item_id=bill_item.item_id, qty=qty, rate=bill_item.rate, line_total=line_total,
            )
        )

        item = db.get(Item, bill_item.item_id)
        apply_ledger_movement(
            db, tenant_id=tenant_id, warehouse_id=warehouse_id, item_id=bill_item.item_id,
            qty=-qty, rate=item.standard_cost, movement_type="purchase_return",
            reference_type="purchase_return", reference_id=purchase_return.id, user_id=user_id,
        )

        total += line_total
        taxable_total += taxable
        cgst_total += cgst
        sgst_total += sgst
        igst_total += igst

    purchase_return.total = total
    db.flush()

    _post_return_journal(
        db, tenant_id=tenant_id, purchase_return=purchase_return, company_id=company_id, branch_id=branch_id,
        taxable_total=taxable_total, cgst_total=cgst_total, sgst_total=sgst_total, igst_total=igst_total,
        supplier_id=bill.supplier_id,
    )
    return purchase_return


def _post_return_journal(
    db: Session, *, tenant_id, purchase_return: PurchaseReturn, company_id, branch_id,
    taxable_total: Decimal, cgst_total: Decimal, sgst_total: Decimal, igst_total: Decimal, supplier_id,
) -> None:
    ap = get_account(db, tenant_id=tenant_id, company_id=company_id, code="2000-AP")
    purchases = get_account(db, tenant_id=tenant_id, company_id=company_id, code="5000-PURCHASES")

    entry = JournalEntry(
        tenant_id=tenant_id, company_id=company_id, branch_id=branch_id, entry_date=purchase_return.return_date,
        document_type="purchase_return", document_id=purchase_return.id, narration=f"Purchase return {purchase_return.number}",
    )
    db.add(entry)
    db.flush()

    def line(account_id, *, debit=Decimal("0"), credit=Decimal("0")):
        if debit == 0 and credit == 0:
            return
        db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=account_id, debit=debit, credit=credit, party_type="supplier", party_id=supplier_id))

    # Reverses the original purchase bill's postings: Purchases goes down
    # (credit), Input GST goes down (credit) -- AP goes down (debit), we
    # owe the supplier less.
    line(purchases.id, credit=taxable_total)
    if cgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="1300-INPUT-CGST").id, credit=cgst_total)
    if sgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="1310-INPUT-SGST").id, credit=sgst_total)
    if igst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=company_id, code="1320-INPUT-IGST").id, credit=igst_total)
    line(ap.id, debit=taxable_total + cgst_total + sgst_total + igst_total)

    db.flush()
