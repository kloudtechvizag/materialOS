import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.accounting import JournalEntry, JournalLine
from app.models.sales import Invoice, PaymentAllocation, Receipt
from app.services.accounts import get_account
from app.services.numbering import next_document_number


def _outstanding_for_invoice(db: Session, invoice_id: uuid.UUID) -> Decimal:
    invoice = db.get(Invoice, invoice_id)
    allocated = db.execute(
        select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(
            PaymentAllocation.invoice_id == invoice_id
        )
    ).scalar_one()
    return invoice.total - Decimal(allocated)


def record_receipt(
    db: Session,
    *,
    tenant_id: uuid.UUID,
    company_id: uuid.UUID,
    branch_id: uuid.UUID,
    financial_year_id: uuid.UUID,
    customer_id: uuid.UUID,
    amount: Decimal,
    mode: str,
    reference_note: str | None,
    invoice_id: uuid.UUID | None = None,
) -> Receipt:
    """If invoice_id is given, allocate against it (part-payment allowed).
    Otherwise auto-allocate oldest-invoice-first against this customer's
    open invoices -- dev.md's collections module reads the same ageing.
    """
    number = next_document_number(
        db,
        company_id=company_id,
        branch_id=branch_id,
        financial_year_id=financial_year_id,
        doc_type="RCPT",
        default_prefix="RCPT",
    )

    receipt = Receipt(
        tenant_id=tenant_id,
        number=number,
        company_id=company_id,
        branch_id=branch_id,
        customer_id=customer_id,
        receipt_date=date.today(),
        amount=amount,
        mode=mode,
        reference_note=reference_note,
    )
    db.add(receipt)
    db.flush()

    remaining = amount
    if invoice_id is not None:
        target_invoices = [db.get(Invoice, invoice_id)]
    else:
        target_invoices = db.execute(
            select(Invoice)
            .where(Invoice.customer_id == customer_id, Invoice.status == "posted")
            .order_by(Invoice.invoice_date)
        ).scalars().all()

    for invoice in target_invoices:
        if remaining <= 0:
            break
        due = _outstanding_for_invoice(db, invoice.id)
        if due <= 0:
            continue
        allocate = min(due, remaining)
        db.add(
            PaymentAllocation(tenant_id=tenant_id, receipt_id=receipt.id, invoice_id=invoice.id, amount=allocate)
        )
        remaining -= allocate

    if remaining > 0 and invoice_id is not None:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Receipt amount {amount} exceeds the outstanding balance on this invoice.",
        )

    # Any `remaining` past this point is an on-account advance -- still a
    # straightforward Dr Cash/Bank, Cr Accounts Receivable in aggregate;
    # a dedicated "advance from customer" liability account is Slice 4.
    _post_receipt_journal(db, tenant_id=tenant_id, receipt=receipt)
    db.flush()
    return receipt


def _post_receipt_journal(db: Session, *, tenant_id: uuid.UUID, receipt: Receipt) -> None:
    cash_or_bank_code = "1000-CASH" if receipt.mode == "cash" else "1010-BANK"
    cash_or_bank = get_account(db, tenant_id=tenant_id, company_id=receipt.company_id, code=cash_or_bank_code)
    ar = get_account(db, tenant_id=tenant_id, company_id=receipt.company_id, code="1100-AR")

    entry = JournalEntry(
        tenant_id=tenant_id,
        company_id=receipt.company_id,
        branch_id=receipt.branch_id,
        entry_date=receipt.receipt_date,
        document_type="receipt",
        document_id=receipt.id,
        narration=f"Receipt {receipt.number}",
    )
    db.add(entry)
    db.flush()

    db.add(
        JournalLine(
            tenant_id=tenant_id, journal_entry_id=entry.id, account_id=cash_or_bank.id,
            debit=receipt.amount, credit=Decimal("0"), party_type="customer", party_id=receipt.customer_id,
        )
    )
    db.add(
        JournalLine(
            tenant_id=tenant_id, journal_entry_id=entry.id, account_id=ar.id,
            debit=Decimal("0"), credit=receipt.amount, party_type="customer", party_id=receipt.customer_id,
        )
    )
    db.flush()
