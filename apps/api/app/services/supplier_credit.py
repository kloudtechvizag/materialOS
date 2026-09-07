"""Supplier-side mirror of services/credit.py's compute_outstanding."""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.masters import Supplier
from app.models.procurement import PurchaseBill, SupplierPaymentAllocation


def compute_payable(db: Session, supplier_id: uuid.UUID) -> Decimal:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise ValueError(f"Unknown supplier {supplier_id}")

    billed_total = db.execute(
        select(func.coalesce(func.sum(PurchaseBill.total), 0)).where(
            PurchaseBill.supplier_id == supplier_id, PurchaseBill.status == "posted"
        )
    ).scalar_one()

    allocated_total = db.execute(
        select(func.coalesce(func.sum(SupplierPaymentAllocation.amount), 0))
        .join(PurchaseBill, PurchaseBill.id == SupplierPaymentAllocation.purchase_bill_id)
        .where(PurchaseBill.supplier_id == supplier_id)
    ).scalar_one()

    return supplier.opening_balance + Decimal(billed_total) - Decimal(allocated_total)
