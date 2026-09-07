"""D1/D4 + dev.md §37/§60: GSTR-1 and GSTR-3B *data extracts* -- the
brief is explicit this is not e-filing, just the numbers a CA (or a
GSP's own filing tool) needs, shaped the way the GST portal's return
sections are shaped. Sections chosen are the ones that actually matter
for this ICP: B2B (registered customers), B2CS (unregistered/retail,
summarized by place of supply + rate per the portal's own rule -- never
per-invoice), CDNR (credit notes against registered customers, reusing
Slice 2's SalesReturn), and the HSN summary every return needs
regardless of customer mix.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.models.masters import Customer, Item
from app.models.sales import Invoice, InvoiceItem
from app.models.warehouse_ops import SalesReturn, SalesReturnItem


@dataclass
class B2BInvoice:
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


@dataclass
class B2CSLine:
    place_of_supply: str
    tax_rate: Decimal
    taxable_value: Decimal
    cgst: Decimal
    sgst: Decimal
    igst: Decimal


@dataclass
class CDNRLine:
    customer_gstin: str
    customer_name: str
    note_number: str
    note_date: date
    taxable_value: Decimal
    tax_amount: Decimal


@dataclass
class HsnSummaryLine:
    hsn_code: str
    uom: str
    total_qty: Decimal
    taxable_value: Decimal
    tax_amount: Decimal


@dataclass
class Gstr1Extract:
    period_month: int
    period_year: int
    b2b: list[B2BInvoice] = field(default_factory=list)
    b2cs: list[B2CSLine] = field(default_factory=list)
    cdnr: list[CDNRLine] = field(default_factory=list)
    hsn_summary: list[HsnSummaryLine] = field(default_factory=list)


def gstr1_extract(db: Session, *, month: int, year: int) -> Gstr1Extract:
    invoices = db.execute(
        select(Invoice, Customer)
        .join(Customer, Customer.id == Invoice.customer_id)
        .where(Invoice.status == "posted", extract("month", Invoice.invoice_date) == month, extract("year", Invoice.invoice_date) == year)
    ).all()

    b2b: list[B2BInvoice] = []
    b2cs_buckets: dict[tuple[str, Decimal], list[Decimal]] = {}

    for invoice, customer in invoices:
        if customer.gstin:
            b2b.append(
                B2BInvoice(
                    customer_gstin=customer.gstin, customer_name=customer.name, invoice_number=invoice.number,
                    invoice_date=invoice.invoice_date, place_of_supply=invoice.place_of_supply_state,
                    taxable_value=invoice.subtotal, cgst=_sum_invoice_tax(db, invoice.id, "cgst"),
                    sgst=_sum_invoice_tax(db, invoice.id, "sgst"), igst=_sum_invoice_tax(db, invoice.id, "igst"),
                    total=invoice.total,
                )
            )
        else:
            items = db.execute(select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)).scalars().all()
            for line in items:
                rate = _effective_rate(line)
                key = (invoice.place_of_supply_state, rate)
                bucket = b2cs_buckets.setdefault(key, [Decimal("0")] * 4)
                bucket[0] += line.taxable_value
                bucket[1] += line.cgst_amount
                bucket[2] += line.sgst_amount
                bucket[3] += line.igst_amount

    b2cs = [
        B2CSLine(place_of_supply=k[0], tax_rate=k[1], taxable_value=v[0], cgst=v[1], sgst=v[2], igst=v[3])
        for k, v in b2cs_buckets.items()
    ]

    returns = db.execute(
        select(SalesReturn, Invoice, Customer)
        .join(Invoice, Invoice.id == SalesReturn.invoice_id)
        .join(Customer, Customer.id == Invoice.customer_id)
        .where(Customer.gstin.is_not(None), extract("month", SalesReturn.return_date) == month, extract("year", SalesReturn.return_date) == year)
    ).all()
    cdnr = [
        CDNRLine(
            customer_gstin=customer.gstin, customer_name=customer.name, note_number=sr.number, note_date=sr.return_date,
            taxable_value=_sales_return_taxable(db, sr.id), tax_amount=sr.total - _sales_return_taxable(db, sr.id),
        )
        for sr, invoice, customer in returns
    ]

    hsn_summary = _hsn_summary(db, month=month, year=year)

    return Gstr1Extract(period_month=month, period_year=year, b2b=b2b, b2cs=b2cs, cdnr=cdnr, hsn_summary=hsn_summary)


def _effective_rate(line: InvoiceItem) -> Decimal:
    return line.cgst_rate + line.sgst_rate + line.igst_rate


def _sum_invoice_tax(db: Session, invoice_id: uuid.UUID, field_name: str) -> Decimal:
    column = {"cgst": InvoiceItem.cgst_amount, "sgst": InvoiceItem.sgst_amount, "igst": InvoiceItem.igst_amount}[field_name]
    from sqlalchemy import func

    return db.execute(select(func.coalesce(func.sum(column), 0)).where(InvoiceItem.invoice_id == invoice_id)).scalar_one()


def _sales_return_taxable(db: Session, sales_return_id: uuid.UUID) -> Decimal:
    from sqlalchemy import func

    lines = db.execute(select(SalesReturnItem).where(SalesReturnItem.sales_return_id == sales_return_id)).scalars().all()
    # line_total already includes tax proportionally; recover taxable value via the source invoice item's ratio.
    total = Decimal("0")
    for line in lines:
        invoice_item = db.get(InvoiceItem, line.invoice_item_id)
        proportion = line.qty / invoice_item.qty
        total += invoice_item.taxable_value * proportion
    return total


def _hsn_summary(db: Session, *, month: int, year: int) -> list[HsnSummaryLine]:
    from sqlalchemy import func

    rows = db.execute(
        select(Item.hsn_code, Item.base_uom, func.sum(InvoiceItem.qty), func.sum(InvoiceItem.taxable_value), func.sum(InvoiceItem.cgst_amount + InvoiceItem.sgst_amount + InvoiceItem.igst_amount))
        .join(InvoiceItem, InvoiceItem.item_id == Item.id)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.status == "posted", extract("month", Invoice.invoice_date) == month, extract("year", Invoice.invoice_date) == year)
        .group_by(Item.hsn_code, Item.base_uom)
    ).all()
    return [
        HsnSummaryLine(hsn_code=hsn or "UNSPECIFIED", uom=uom, total_qty=Decimal(qty), taxable_value=Decimal(taxable), tax_amount=Decimal(tax))
        for hsn, uom, qty, taxable, tax in rows
    ]


@dataclass
class Gstr3bExtract:
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


def gstr3b_extract(db: Session, *, month: int, year: int) -> Gstr3bExtract:
    """Scope note: net tax payable here is computed per tax head
    (CGST/SGST/IGST) independently -- real GSTR-3B allows cross-utilizing
    IGST input credit against a CGST or SGST liability in a specific
    statutory order (Section 49 of the CGST Act). That cross-utilization
    logic is not implemented; a CA reviewing this extract needs to apply
    it before filing, same as they would need to apply it to a Tally
    export.
    """
    from sqlalchemy import func

    outward = db.execute(
        select(
            func.coalesce(func.sum(InvoiceItem.taxable_value), 0), func.coalesce(func.sum(InvoiceItem.cgst_amount), 0),
            func.coalesce(func.sum(InvoiceItem.sgst_amount), 0), func.coalesce(func.sum(InvoiceItem.igst_amount), 0),
        )
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.status == "posted", extract("month", Invoice.invoice_date) == month, extract("year", Invoice.invoice_date) == year)
    ).one()

    from app.models.procurement import PurchaseBill, PurchaseBillItem

    itc = db.execute(
        select(func.coalesce(func.sum(PurchaseBillItem.cgst_amount), 0), func.coalesce(func.sum(PurchaseBillItem.sgst_amount), 0), func.coalesce(func.sum(PurchaseBillItem.igst_amount), 0))
        .join(PurchaseBill, PurchaseBill.id == PurchaseBillItem.purchase_bill_id)
        .where(PurchaseBill.status == "posted", extract("month", PurchaseBill.bill_date) == month, extract("year", PurchaseBill.bill_date) == year)
    ).one()

    outward_taxable, out_cgst, out_sgst, out_igst = (Decimal(x) for x in outward)
    itc_cgst, itc_sgst, itc_igst = (Decimal(x) for x in itc)
    net_payable = max(out_cgst - itc_cgst, Decimal("0")) + max(out_sgst - itc_sgst, Decimal("0")) + max(out_igst - itc_igst, Decimal("0"))

    return Gstr3bExtract(
        period_month=month, period_year=year, outward_taxable_value=outward_taxable,
        outward_cgst=out_cgst, outward_sgst=out_sgst, outward_igst=out_igst,
        input_tax_credit_cgst=itc_cgst, input_tax_credit_sgst=itc_sgst, input_tax_credit_igst=itc_igst,
        net_tax_payable=net_payable,
    )
