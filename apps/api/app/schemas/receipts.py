import uuid
from decimal import Decimal

from pydantic import BaseModel


class ReceiptSettingsOut(BaseModel):
    show_logo: bool
    show_customer_details: bool
    show_gst_breakdown: bool
    show_sku: bool
    show_cashier: bool
    show_qr_code: bool
    footer_message: str | None
    terms_and_conditions: str | None
    return_policy: str | None
    upi_id: str | None
    social_contact_info: str | None
    default_paper_width_mm: int

    class Config:
        from_attributes = True


class ReceiptSettingsUpdate(BaseModel):
    show_logo: bool | None = None
    show_customer_details: bool | None = None
    show_gst_breakdown: bool | None = None
    show_sku: bool | None = None
    show_cashier: bool | None = None
    show_qr_code: bool | None = None
    footer_message: str | None = None
    terms_and_conditions: str | None = None
    return_policy: str | None = None
    upi_id: str | None = None
    social_contact_info: str | None = None
    default_paper_width_mm: int | None = None


class ReceiptLineItem(BaseModel):
    name: str
    sku: str | None = None
    qty: Decimal
    uom: str
    rate: Decimal
    discount: Decimal = Decimal("0")
    tax_rate: Decimal = Decimal("0")
    line_total: Decimal


class ReceiptData(BaseModel):
    document_type: str
    document_number: str
    document_date: str
    document_time: str | None = None

    company_name: str
    company_legal_name: str
    company_gstin: str | None = None
    company_phone: str | None = None
    company_email: str | None = None
    company_address: str | None = None

    branch_name: str
    branch_gstin: str | None = None

    cashier_name: str | None = None

    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    customer_gstin: str | None = None
    place_of_supply: str | None = None

    items: list[ReceiptLineItem]

    subtotal: Decimal
    total_discount: Decimal = Decimal("0")
    cgst_amount: Decimal = Decimal("0")
    sgst_amount: Decimal = Decimal("0")
    igst_amount: Decimal = Decimal("0")
    round_off: Decimal = Decimal("0")
    grand_total: Decimal

    payment_method: str | None = None
    amount_paid: Decimal | None = None
    balance_due: Decimal | None = None
    change_due: Decimal | None = None
    customer_credit_balance: Decimal | None = None

    notes: str | None = None
    settings: ReceiptSettingsOut
