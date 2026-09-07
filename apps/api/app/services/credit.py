"""dev.md §25: a new order automatically evaluates credit against
Customer.credit_limit. Outstanding = opening_balance (Slice 0 baseline)
+ posted invoice totals - allocated receipts (Part C's definition).
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.masters import Customer
from app.models.sales import Invoice, PaymentAllocation


def compute_outstanding(db: Session, customer_id: uuid.UUID) -> Decimal:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise ValueError(f"Unknown customer {customer_id}")

    invoiced_total = db.execute(
        select(func.coalesce(func.sum(Invoice.total), 0)).where(
            Invoice.customer_id == customer_id, Invoice.status == "posted"
        )
    ).scalar_one()

    allocated_total = db.execute(
        select(func.coalesce(func.sum(PaymentAllocation.amount), 0))
        .join(Invoice, Invoice.id == PaymentAllocation.invoice_id)
        .where(Invoice.customer_id == customer_id)
    ).scalar_one()

    return customer.opening_balance + Decimal(invoiced_total) - Decimal(allocated_total)


def check_credit(db: Session, customer_id: uuid.UUID, additional_amount: Decimal) -> None:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise ValueError(f"Unknown customer {customer_id}")

    if customer.credit_limit <= 0:
        return  # no limit configured -- nothing to enforce

    outstanding = compute_outstanding(db, customer_id)
    projected = outstanding + additional_amount
    if projected > customer.credit_limit:
        raise AppError(
            ErrorCode.CREDIT_LIMIT_EXCEEDED,
            f"This order takes {customer.name}'s outstanding to {projected}, "
            f"over the credit limit of {customer.credit_limit}.",
            status_code=409,
            details={
                "customer_id": str(customer_id),
                "credit_limit": str(customer.credit_limit),
                "current_outstanding": str(outstanding),
                "projected_outstanding": str(projected),
                "excess": str(projected - customer.credit_limit),
            },
        )
