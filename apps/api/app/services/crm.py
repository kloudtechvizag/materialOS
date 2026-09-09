"""Lead pipeline: Lead -> (qualify) -> convert -> a real Customer row,
picking up right where the rest of the Business Graph (Customer ->
Quotation -> SalesOrder -> ...) already starts. Converting doesn't
mutate the Lead into a Customer -- it creates a genuine new Customer
and links back via Lead.converted_customer_id, so every Customer
anywhere else in the system (credit checks, invoices, portal access)
still means exactly what it always has.
"""
import uuid

from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.crm import Lead
from app.models.masters import Customer


def create_lead(db: Session, *, tenant_id: uuid.UUID, company_id: uuid.UUID, data: dict) -> Lead:
    lead = Lead(tenant_id=tenant_id, company_id=company_id, status="new", **data)
    db.add(lead)
    db.flush()
    return lead


def convert_lead_to_customer(
    db: Session, *, tenant_id: uuid.UUID, lead_id: uuid.UUID,
    billing_state: str | None = None, credit_limit=None, credit_days: int | None = None,
) -> tuple[Lead, Customer]:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise AppError(ErrorCode.NOT_FOUND, "Lead not found.", status_code=404)
    if lead.converted_customer_id is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "This lead has already been converted.")
    if lead.status == "lost":
        raise AppError(ErrorCode.VALIDATION_ERROR, "A lost lead can't be converted -- reopen it first.")

    customer = Customer(
        tenant_id=tenant_id,
        company_id=lead.company_id,
        name=lead.company_name or lead.name,
        phone=lead.phone,
        email=lead.email,
        billing_state=billing_state,
        credit_limit=credit_limit or 0,
        credit_days=credit_days or 0,
    )
    db.add(customer)
    db.flush()

    lead.status = "won"
    lead.converted_customer_id = customer.id
    db.flush()
    return lead, customer
