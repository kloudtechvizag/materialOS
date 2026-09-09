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


def compute_payable_bulk(db: Session, tenant_id: uuid.UUID) -> dict[uuid.UUID, Decimal]:
    """Same math as compute_payable(), batched with two GROUP BY queries
    instead of N calls -- for the suppliers list page, which needs every
    row's balance at once, not just one supplier's."""
    opening = dict(
        db.execute(select(Supplier.id, Supplier.opening_balance).where(Supplier.tenant_id == tenant_id)).all()
    )

    billed_by_supplier = dict(
        db.execute(
            select(PurchaseBill.supplier_id, func.coalesce(func.sum(PurchaseBill.total), 0))
            .where(PurchaseBill.tenant_id == tenant_id, PurchaseBill.status == "posted")
            .group_by(PurchaseBill.supplier_id)
        ).all()
    )

    allocated_by_supplier = dict(
        db.execute(
            select(PurchaseBill.supplier_id, func.coalesce(func.sum(SupplierPaymentAllocation.amount), 0))
            .select_from(SupplierPaymentAllocation)
            .join(PurchaseBill, PurchaseBill.id == SupplierPaymentAllocation.purchase_bill_id)
            .where(PurchaseBill.tenant_id == tenant_id)
            .group_by(PurchaseBill.supplier_id)
        ).all()
    )

    return {
        supplier_id: opening_balance + Decimal(billed_by_supplier.get(supplier_id, 0)) - Decimal(allocated_by_supplier.get(supplier_id, 0))
        for supplier_id, opening_balance in opening.items()
    }
