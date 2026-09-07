from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class B2BInvoiceOut(BaseModel):
    customer_gstin: str
    customer_name: str
    invoice_number: str
    invoice_date: date
    place_of_supply: str
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal


class B2CSLineOut(BaseModel):
    place_of_supply: str
    tax_rate: Decimal
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal


class CDNRLineOut(BaseModel):
    customer_gstin: str
    customer_name: str
    note_number: str
    note_date: date
    taxable_value: Decimal
    tax_amount: Decimal


class HsnSummaryLineOut(BaseModel):
    hsn_code: str
    uom: str
    total_qty: Decimal
    taxable_value: Decimal
    tax_amount: Decimal


class Gstr1ExtractOut(BaseModel):
    period_month: int
    period_year: int
    b2b: list[B2BInvoiceOut]
    b2cs: list[B2CSLineOut]
    cdnr: list[CDNRLineOut]
    hsn_summary: list[HsnSummaryLineOut]


class Gstr3bExtractOut(BaseModel):
    period_month: int
    period_year: int
    outward_taxable_value: Decimal
    outward_cgst: Decimal
    outward_sgst: Decimal
    outward_igst: Decimal
    input_tax_credit_cgst: Decimal
    input_tax_credit_sgst: Decimal
    input_tax_credit_igst: Decimal
    net_tax_payable: Decimal
