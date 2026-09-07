"""dev.md §58: customer self-service portal. Every function here takes a
`customer` (from deps.get_portal_customer) and scopes its query to that
customer's own rows -- ownership is re-checked on every read/write of a
document looked up by id, not assumed from the id alone, because RLS
only enforces tenant isolation, not per-customer isolation within a
tenant (see ADR-009).
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.masters import Customer
from app.models.portal import PortalDocument
from app.models.sales import DeliveryChallan, Invoice, Quotation, Receipt, SalesOrder
from app.models.tenant import Branch, Company
from app.models.user import Role, User, UserRole
from app.security import hash_password
from app.services.notifications import notify
from app.services.numbering import get_current_financial_year
from app.services.receipts import record_receipt
from app.storage import save_file


def _owned_or_404(obj, customer_id: uuid.UUID, label: str):
    if obj is None or obj.customer_id != customer_id:
        raise AppError(ErrorCode.NOT_FOUND, f"{label} not found.", status_code=404)
    return obj


# ------------------------------------------------------------- Provisioning

def create_portal_login(
    db: Session, *, tenant_id: uuid.UUID, customer: Customer, email: str, password: str, full_name: str,
) -> User:
    """Staff-side action (Customer360Page's "Create portal access"). The
    "customer" role carries no RBAC permissions -- portal endpoints scope
    on User.customer_id via deps.get_portal_customer, not on permission
    checks (ADR-009).
    """
    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        raise AppError(ErrorCode.CONFLICT, "A user with this email already exists.", status_code=409)

    role = db.execute(
        select(Role).where(Role.tenant_id == tenant_id, Role.name == "customer")
    ).scalar_one_or_none()
    if role is None:
        role = Role(tenant_id=tenant_id, name="customer", is_system=True)
        db.add(role)
        db.flush()

    user = User(
        tenant_id=tenant_id, email=email, hashed_password=hash_password(password), full_name=full_name,
        customer_id=customer.id,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(tenant_id=tenant_id, user_id=user.id, role_id=role.id, branch_id=None))
    db.flush()
    return user


# --------------------------------------------------------------- Quotations

def list_quotations(db: Session, customer: Customer) -> list[Quotation]:
    return db.execute(
        select(Quotation).where(Quotation.customer_id == customer.id).order_by(Quotation.created_at.desc())
    ).scalars().all()


def get_quotation(db: Session, customer: Customer, quotation_id: uuid.UUID) -> Quotation:
    return _owned_or_404(db.get(Quotation, quotation_id), customer.id, "Quotation")


def decide_quotation(db: Session, customer: Customer, quotation_id: uuid.UUID, *, approve: bool) -> Quotation:
    quotation = get_quotation(db, customer, quotation_id)
    if quotation.status != "sent":
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Only a sent quotation can be approved or rejected.",
            details={"current_status": quotation.status},
        )
    quotation.status = "approved" if approve else "rejected"
    db.flush()
    notify(
        db, tenant_id=customer.tenant_id, notification_type="quotation_decided",
        title=f"Quotation {quotation.number} {quotation.status} by customer",
        message=f"{customer.name} {quotation.status} quotation {quotation.number}.",
        entity_type="quotation", entity_id=quotation.id,
    )
    return quotation


# ------------------------------------------------------------- Sales orders

def list_sales_orders(db: Session, customer: Customer) -> list[SalesOrder]:
    return db.execute(
        select(SalesOrder).where(SalesOrder.customer_id == customer.id).order_by(SalesOrder.created_at.desc())
    ).scalars().all()


def get_sales_order(db: Session, customer: Customer, sales_order_id: uuid.UUID) -> SalesOrder:
    return _owned_or_404(db.get(SalesOrder, sales_order_id), customer.id, "Sales order")


# ----------------------------------------------------------------- Invoices

def list_invoices(db: Session, customer: Customer) -> list[Invoice]:
    return db.execute(
        select(Invoice).where(Invoice.customer_id == customer.id).order_by(Invoice.invoice_date.desc())
    ).scalars().all()


def get_invoice(db: Session, customer: Customer, invoice_id: uuid.UUID) -> Invoice:
    return _owned_or_404(db.get(Invoice, invoice_id), customer.id, "Invoice")


# --------------------------------------------------------------- Deliveries

def list_deliveries(db: Session, customer: Customer) -> list[DeliveryChallan]:
    return db.execute(
        select(DeliveryChallan)
        .join(SalesOrder, SalesOrder.id == DeliveryChallan.sales_order_id)
        .where(SalesOrder.customer_id == customer.id)
        .order_by(DeliveryChallan.dispatch_date.desc())
    ).scalars().all()


# ---------------------------------------------------------------- Statement

@dataclass
class StatementLine:
    entry_date: date
    doc_type: str
    doc_number: str
    debit: Decimal
    credit: Decimal
    balance: Decimal


def get_statement(db: Session, customer: Customer) -> list[StatementLine]:
    invoices = db.execute(
        select(Invoice).where(Invoice.customer_id == customer.id, Invoice.status == "posted").order_by(Invoice.invoice_date)
    ).scalars().all()
    receipts = db.execute(
        select(Receipt).where(Receipt.customer_id == customer.id).order_by(Receipt.receipt_date)
    ).scalars().all()

    events = [(inv.invoice_date, "invoice", inv.number, inv.total, Decimal("0")) for inv in invoices]
    events += [(r.receipt_date, "receipt", r.number, Decimal("0"), r.amount) for r in receipts]
    events.sort(key=lambda e: e[0])

    balance = customer.opening_balance
    lines: list[StatementLine] = []
    if customer.opening_balance_as_of is not None:
        lines.append(StatementLine(customer.opening_balance_as_of, "opening_balance", "OPENING", customer.opening_balance, Decimal("0"), balance))

    for entry_date, doc_type, number, debit, credit in events:
        balance += debit - credit
        lines.append(StatementLine(entry_date, doc_type, number, debit, credit, balance))

    return lines


# --------------------------------------------------------------- Documents

def upload_po_document(
    db: Session, customer: Customer, *, file_name: str, content: bytes,
    quotation_id: uuid.UUID | None = None, sales_order_id: uuid.UUID | None = None,
) -> PortalDocument:
    if quotation_id is not None:
        get_quotation(db, customer, quotation_id)
    if sales_order_id is not None:
        get_sales_order(db, customer, sales_order_id)

    storage_path = save_file(tenant_id=customer.tenant_id, category="portal_documents", file_name=file_name, content=content)
    document = PortalDocument(
        tenant_id=customer.tenant_id, customer_id=customer.id, quotation_id=quotation_id, sales_order_id=sales_order_id,
        file_name=file_name, storage_path=storage_path, uploaded_at=datetime.now(timezone.utc),
    )
    db.add(document)
    db.flush()
    return document


# ----------------------------------------------------- Payment intimation

def submit_payment_intimation(
    db: Session, customer: Customer, *, amount: Decimal, mode: str, reference_note: str | None,
    invoice_id: uuid.UUID | None = None,
) -> Receipt:
    """dev.md §58's "make a payment" (ADR-009): this records a real Receipt
    the same way staff-recorded payments do -- it is an intimation of a
    payment made elsewhere (cash/UPI/NEFT reference), not a payment
    gateway capture. No gateway credentials exist here.
    """
    if invoice_id is not None:
        get_invoice(db, customer, invoice_id)

    company = db.get(Company, customer.company_id)
    branch = db.execute(select(Branch).where(Branch.company_id == company.id)).scalars().first()
    fy = get_current_financial_year(db, company.id)

    note = f"Customer portal intimation. {reference_note or ''}".strip()
    receipt = record_receipt(
        db, tenant_id=customer.tenant_id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, amount=amount, mode=mode, reference_note=note, invoice_id=invoice_id,
    )
    notify(
        db, tenant_id=customer.tenant_id, notification_type="payment_intimation",
        title=f"Payment intimation from {customer.name}",
        message=f"{customer.name} reported a payment of {amount} ({mode}). Verify and reconcile.",
        entity_type="receipt", entity_id=receipt.id,
    )
    return receipt
