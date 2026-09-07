"""dev.md §32-34: Purchase Request -> PO -> Goods Receipt -> QC ->
Purchase Bill -> Payment, with landed cost allocated across a receipt's
lines. Mirrors Slice 1's Quotation -> Order -> Dispatch -> Invoice
pattern on the buy side.
"""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.accounting import JournalEntry, JournalLine
from app.models.masters import Item
from app.models.procurement import (
    GoodsReceipt,
    GoodsReceiptItem,
    LandedCostEntry,
    PurchaseBill,
    PurchaseBillItem,
    PurchaseOrder,
    PurchaseOrderItem,
    SupplierPayment,
    SupplierPaymentAllocation,
)
from app.models.masters import Supplier
from app.models.tenant import Company
from app.services.accounts import get_account
from app.services.inventory import apply_ledger_movement
from app.services.money import round_line_tax
from app.services.numbering import next_document_number
from app.tax.resolve import resolve_tax


def create_purchase_order(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, warehouse_id: uuid.UUID,
    supplier_id: uuid.UUID, financial_year_id: uuid.UUID, lines: list[dict],
) -> PurchaseOrder:
    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="PO", default_prefix="PO",
    )
    order = PurchaseOrder(
        tenant_id=tenant_id, number=number, company_id=company_id, branch_id=branch_id, warehouse_id=warehouse_id,
        supplier_id=supplier_id, po_date=date.today(), status="draft", subtotal=Decimal("0"),
    )
    db.add(order)
    db.flush()

    subtotal = Decimal("0")
    for line in lines:
        item = db.get(Item, line["item_id"])
        qty = Decimal(str(line["qty"]))
        rate = Decimal(str(line["rate"]))
        line_total = qty * rate
        db.add(
            PurchaseOrderItem(
                tenant_id=tenant_id, purchase_order_id=order.id, item_id=item.id, qty=qty,
                uom=line.get("uom") or item.base_uom, rate=rate, line_total=line_total,
            )
        )
        subtotal += line_total

    order.subtotal = subtotal
    db.flush()
    return order


def approve_purchase_order(db: Session, *, purchase_order_id: uuid.UUID) -> PurchaseOrder:
    order = db.get(PurchaseOrder, purchase_order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase order not found.", status_code=404)
    if order.status != "draft":
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only a draft purchase order can be approved.")
    order.status = "approved"
    db.flush()
    return order


def receive_goods(
    db: Session, *, tenant_id: uuid.UUID, purchase_order_id: uuid.UUID, financial_year_id: uuid.UUID,
    lines: list[dict], user_id: uuid.UUID,  # [{purchase_order_item_id, qty_received, qc_status}]
) -> GoodsReceipt:
    order = db.get(PurchaseOrder, purchase_order_id)
    if order is None:
        raise AppError(ErrorCode.NOT_FOUND, "Purchase order not found.", status_code=404)
    if order.status not in ("approved", "partially_received"):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Only an approved purchase order can receive goods.")

    number = next_document_number(
        db, company_id=order.company_id, branch_id=order.branch_id, financial_year_id=financial_year_id,
        doc_type="GRN", default_prefix="GRN",
    )
    receipt = GoodsReceipt(
        tenant_id=tenant_id, number=number, company_id=order.company_id, branch_id=order.branch_id,
        purchase_order_id=order.id, warehouse_id=order.warehouse_id, receipt_date=date.today(), status="received",
    )
    db.add(receipt)
    db.flush()

    for line in lines:
        poi = db.get(PurchaseOrderItem, line["purchase_order_item_id"])
        qty_received = Decimal(str(line["qty_received"]))
        qc_status = line.get("qc_status", "passed")

        db.add(
            GoodsReceiptItem(
                tenant_id=tenant_id, goods_receipt_id=receipt.id, purchase_order_item_id=poi.id, item_id=poi.item_id,
                qty_received=qty_received, rate=poi.rate, landed_unit_cost=poi.rate, qc_status=qc_status,
            )
        )
        poi.qty_received += qty_received

        # Only QC-passed stock becomes sellable/usable (dev.md §32's QC step
        # exists precisely to keep failed stock out of the ledger until
        # someone disposes of or returns it -- Slice 3 scope stops there).
        if qc_status == "passed":
            apply_ledger_movement(
                db, tenant_id=tenant_id, warehouse_id=order.warehouse_id, item_id=poi.item_id,
                qty=qty_received, rate=poi.rate, movement_type="purchase",
                reference_type="goods_receipt", reference_id=receipt.id, user_id=user_id,
            )

    db.flush()
    order_items = db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id)).scalars().all()
    order.status = "received" if all(i.qty_received >= i.qty for i in order_items) else "partially_received"
    db.flush()
    return receipt


def allocate_landed_cost(
    db: Session, *, tenant_id: uuid.UUID, goods_receipt_id: uuid.UUID, cost_type: str, amount: Decimal,
    allocation_method: str = "value",
) -> GoodsReceipt:
    """dev.md §34: allocate freight/handling/etc across a receipt's lines
    by quantity or value, then fold the result into each line's landed
    unit cost and into Item.standard_cost (ADR-006: latest cost wins).
    """
    receipt = db.get(GoodsReceipt, goods_receipt_id)
    if receipt is None:
        raise AppError(ErrorCode.NOT_FOUND, "Goods receipt not found.", status_code=404)

    db.add(
        LandedCostEntry(
            tenant_id=tenant_id, goods_receipt_id=receipt.id, cost_type=cost_type, amount=amount,
            allocation_method=allocation_method,
        )
    )
    db.flush()

    entries = db.execute(select(LandedCostEntry).where(LandedCostEntry.goods_receipt_id == receipt.id)).scalars().all()
    lines = db.execute(select(GoodsReceiptItem).where(GoodsReceiptItem.goods_receipt_id == receipt.id)).scalars().all()

    total_value = sum((line.qty_received * line.rate for line in lines), Decimal("0"))
    total_qty = sum((line.qty_received for line in lines), Decimal("0"))

    allocated_share: dict[uuid.UUID, Decimal] = {line.id: Decimal("0") for line in lines}
    for entry in entries:
        for line in lines:
            if entry.allocation_method == "quantity" and total_qty > 0:
                share = entry.amount * (line.qty_received / total_qty)
            elif total_value > 0:
                share = entry.amount * ((line.qty_received * line.rate) / total_value)
            else:
                share = Decimal("0")
            allocated_share[line.id] += share

    landed_cost_total = Decimal("0")
    for line in lines:
        extra_per_unit = (allocated_share[line.id] / line.qty_received) if line.qty_received else Decimal("0")
        line.landed_unit_cost = round_line_tax(line.rate + extra_per_unit)
        landed_cost_total += allocated_share[line.id]

        item = db.get(Item, line.item_id)
        item.standard_cost = line.landed_unit_cost

    receipt.landed_cost_total = landed_cost_total
    db.flush()
    return receipt


def create_purchase_bill(
    db: Session, *, tenant_id: uuid.UUID, financial_year_id: uuid.UUID, goods_receipt_id: uuid.UUID,
) -> PurchaseBill:
    receipt = db.get(GoodsReceipt, goods_receipt_id)
    if receipt is None:
        raise AppError(ErrorCode.NOT_FOUND, "Goods receipt not found.", status_code=404)
    order = db.get(PurchaseOrder, receipt.purchase_order_id)
    company = db.get(Company, order.company_id)
    supplier = db.get(Supplier, order.supplier_id)
    place_of_supply = supplier.billing_state or company.state or ""

    number = next_document_number(
        db, company_id=order.company_id, branch_id=order.branch_id, financial_year_id=financial_year_id,
        doc_type="PBILL", default_prefix="PBILL",
    )
    bill = PurchaseBill(
        tenant_id=tenant_id, number=number, company_id=order.company_id, branch_id=order.branch_id,
        supplier_id=order.supplier_id, goods_receipt_id=receipt.id, bill_date=date.today(),
        subtotal=Decimal("0"), tax_total=Decimal("0"), total=Decimal("0"),
    )
    db.add(bill)
    db.flush()

    subtotal = cgst_total = sgst_total = igst_total = Decimal("0")
    for line in receipt.items:
        item = db.get(Item, line.item_id)
        taxable_value = line.qty_received * line.rate  # billed at the supplier's rate, not landed cost (ADR-006 note)
        tax = resolve_tax(
            document_date=bill.bill_date, place_of_supply_state=place_of_supply,
            company_state=company.state or "", item=item, taxable_value=taxable_value,
        )
        db.add(
            PurchaseBillItem(
                tenant_id=tenant_id, purchase_bill_id=bill.id, item_id=item.id, qty=line.qty_received, rate=line.rate,
                taxable_value=taxable_value, cgst_amount=tax.cgst_amount, sgst_amount=tax.sgst_amount,
                igst_amount=tax.igst_amount, line_total=taxable_value + tax.total_tax,
            )
        )
        subtotal += taxable_value
        cgst_total += tax.cgst_amount
        sgst_total += tax.sgst_amount
        igst_total += tax.igst_amount

    tax_total = cgst_total + sgst_total + igst_total
    bill.subtotal = subtotal
    bill.tax_total = tax_total
    bill.total = subtotal + tax_total
    db.flush()

    _post_purchase_bill_journal(
        db, tenant_id=tenant_id, bill=bill, subtotal=subtotal,
        cgst_total=cgst_total, sgst_total=sgst_total, igst_total=igst_total,
    )
    return bill


def _post_purchase_bill_journal(
    db: Session, *, tenant_id, bill: PurchaseBill, subtotal: Decimal,
    cgst_total: Decimal, sgst_total: Decimal, igst_total: Decimal,
) -> None:
    purchases = get_account(db, tenant_id=tenant_id, company_id=bill.company_id, code="5000-PURCHASES")
    ap = get_account(db, tenant_id=tenant_id, company_id=bill.company_id, code="2000-AP")

    entry = JournalEntry(
        tenant_id=tenant_id, company_id=bill.company_id, branch_id=bill.branch_id, entry_date=bill.bill_date,
        document_type="purchase_bill", document_id=bill.id, narration=f"Purchase bill {bill.number}",
    )
    db.add(entry)
    db.flush()

    def line(account_id: uuid.UUID, *, debit: Decimal = Decimal("0"), credit: Decimal = Decimal("0")) -> None:
        if debit == 0 and credit == 0:
            return
        db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=account_id, debit=debit, credit=credit, party_type="supplier", party_id=bill.supplier_id))

    line(purchases.id, debit=subtotal)
    if cgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=bill.company_id, code="1300-INPUT-CGST").id, debit=cgst_total)
    if sgst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=bill.company_id, code="1310-INPUT-SGST").id, debit=sgst_total)
    if igst_total:
        line(get_account(db, tenant_id=tenant_id, company_id=bill.company_id, code="1320-INPUT-IGST").id, debit=igst_total)
    line(ap.id, credit=subtotal + cgst_total + sgst_total + igst_total)
    db.flush()


def record_supplier_payment(
    db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, branch_id: uuid.UUID, financial_year_id: uuid.UUID,
    supplier_id: uuid.UUID, amount: Decimal, mode: str, purchase_bill_id: uuid.UUID | None = None,
) -> SupplierPayment:
    number = next_document_number(
        db, company_id=company_id, branch_id=branch_id, financial_year_id=financial_year_id,
        doc_type="SPMT", default_prefix="SPMT",
    )
    payment = SupplierPayment(
        tenant_id=tenant_id, number=number, company_id=company_id, branch_id=branch_id, supplier_id=supplier_id,
        payment_date=date.today(), amount=amount, mode=mode,
    )
    db.add(payment)
    db.flush()

    remaining = amount
    if purchase_bill_id is not None:
        target_bills = [db.get(PurchaseBill, purchase_bill_id)]
    else:
        target_bills = db.execute(
            select(PurchaseBill).where(PurchaseBill.supplier_id == supplier_id, PurchaseBill.status == "posted").order_by(PurchaseBill.bill_date)
        ).scalars().all()

    for bill in target_bills:
        if remaining <= 0:
            break
        allocated = db.execute(
            select(SupplierPaymentAllocation).where(SupplierPaymentAllocation.purchase_bill_id == bill.id)
        ).scalars().all()
        due = bill.total - sum((a.amount for a in allocated), Decimal("0"))
        if due <= 0:
            continue
        pay_now = min(due, remaining)
        db.add(SupplierPaymentAllocation(tenant_id=tenant_id, supplier_payment_id=payment.id, purchase_bill_id=bill.id, amount=pay_now))
        remaining -= pay_now

    _post_supplier_payment_journal(db, tenant_id=tenant_id, payment=payment)
    db.flush()
    return payment


def _post_supplier_payment_journal(db: Session, *, tenant_id, payment: SupplierPayment) -> None:
    cash_or_bank_code = "1000-CASH" if payment.mode == "cash" else "1010-BANK"
    cash_or_bank = get_account(db, tenant_id=tenant_id, company_id=payment.company_id, code=cash_or_bank_code)
    ap = get_account(db, tenant_id=tenant_id, company_id=payment.company_id, code="2000-AP")

    entry = JournalEntry(
        tenant_id=tenant_id, company_id=payment.company_id, branch_id=payment.branch_id, entry_date=payment.payment_date,
        document_type="supplier_payment", document_id=payment.id, narration=f"Payment {payment.number}",
    )
    db.add(entry)
    db.flush()

    db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=ap.id, debit=payment.amount, credit=Decimal("0"), party_type="supplier", party_id=payment.supplier_id))
    db.add(JournalLine(tenant_id=tenant_id, journal_entry_id=entry.id, account_id=cash_or_bank.id, debit=Decimal("0"), credit=payment.amount, party_type="supplier", party_id=payment.supplier_id))
    db.flush()
