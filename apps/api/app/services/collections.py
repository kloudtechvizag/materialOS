"""dev.md §40: collections + ageing buckets. dev.md §41 calls the ranked
list "AI collection prioritization" -- what's built here is a plain,
explainable rule (amount due, then days overdue), not a model. Real
learned prioritization is Slice 5's AI assistant; this module gives it
something correct to build on rather than pretending to be it early.

Master Brief v2 Slice 3's acceptance test is literally "DSO measurably
drops for the pilot customer over 60 days" -- compute_dso is what that
number comes from.
"""

import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.masters import Customer
from app.models.sales import Invoice, PaymentAllocation

BUCKETS = [
    ("current", None, 0),
    ("1-15", 1, 15),
    ("16-30", 16, 30),
    ("31-45", 31, 45),
    ("46+", 46, None),
]


@dataclass
class AgeingLine:
    invoice_id: uuid.UUID
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: str
    invoice_date: date
    due_date: date
    amount_due: Decimal
    days_overdue: int
    bucket: str
    reason: str


def _bucket_for(days_overdue: int) -> str:
    if days_overdue <= 0:
        return "current"
    for name, lo, hi in BUCKETS[1:]:
        if lo is not None and days_overdue >= lo and (hi is None or days_overdue <= hi):
            return name
    return "46+"


def ageing_report(db: Session) -> list[AgeingLine]:
    today = date.today()
    invoices = db.execute(
        select(Invoice, Customer).join(Customer, Customer.id == Invoice.customer_id).where(Invoice.status == "posted")
    ).all()

    lines: list[AgeingLine] = []
    for invoice, customer in invoices:
        allocated = db.execute(
            select(func.coalesce(func.sum(PaymentAllocation.amount), 0)).where(PaymentAllocation.invoice_id == invoice.id)
        ).scalar_one()
        amount_due = invoice.total - Decimal(allocated)
        if amount_due <= 0:
            continue

        due_date = invoice.invoice_date + timedelta(days=customer.credit_days)
        days_overdue = (today - due_date).days
        bucket = _bucket_for(days_overdue)

        if days_overdue > 0:
            reason = f"{days_overdue} days overdue, {amount_due} outstanding"
        else:
            reason = f"Due in {-days_overdue} days"

        lines.append(
            AgeingLine(
                invoice_id=invoice.id, invoice_number=invoice.number, customer_id=customer.id,
                customer_name=customer.name, invoice_date=invoice.invoice_date, due_date=due_date,
                amount_due=amount_due, days_overdue=max(days_overdue, 0), bucket=bucket, reason=reason,
            )
        )
    return lines


def collection_priority(db: Session, *, limit: int = 20) -> list[AgeingLine]:
    lines = [line for line in ageing_report(db) if line.days_overdue > 0]
    lines.sort(key=lambda ln: (ln.amount_due, ln.days_overdue), reverse=True)
    return lines[:limit]


def compute_dso(db: Session, *, period_days: int = 60) -> Decimal | None:
    """DSO = (total receivables outstanding today / credit sales over the
    trailing period) * period_days. None if there were no credit sales in
    the period (nothing to divide by).
    """
    today = date.today()
    period_start = today - timedelta(days=period_days)

    total_receivables = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0))
        .where(Invoice.status == "posted")
    ).scalar_one()
    allocated_total = db.execute(select(func.coalesce(func.sum(PaymentAllocation.amount), 0))).scalar_one()
    outstanding = Decimal(total_receivables) - Decimal(allocated_total)

    credit_sales = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.status == "posted", Invoice.invoice_date >= period_start, Invoice.invoice_date <= today,
        )
    ).scalar_one()
    credit_sales = Decimal(credit_sales)

    if credit_sales == 0:
        return None
    return (outstanding / credit_sales * period_days).quantize(Decimal("0.1"))
