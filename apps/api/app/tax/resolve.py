"""D4: "All of D1-D3 lives in one module (tax/) behind an interface:
resolve_tax(document_date, place_of_supply, item, customer) -> TaxBreakdown.
No GST logic anywhere else in the codebase."

Slice 1 note (ADR-004): the rate itself comes from Item.gst_rate (kept
current by the catalog maintainer) rather than an effective-dated rate
table -- that table, and the admin UI to maintain it, are Slice 4. The
interface shape here already matches what Slice 4 will fill in, so nothing
above this module needs to change when it does.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.models.masters import Item
from app.services.money import round_line_tax


@dataclass
class TaxBreakdown:
    taxable_value: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal
    igst_rate: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal

    @property
    def total_tax(self) -> Decimal:
        return self.cgst_amount + self.sgst_amount + self.igst_amount


def resolve_tax(
    *,
    document_date: date,  # noqa: ARG001 -- kept for the Slice 4 effective-dated lookup this will become
    place_of_supply_state: str,
    company_state: str,
    item: Item,
    taxable_value: Decimal,
) -> TaxBreakdown:
    is_intrastate = place_of_supply_state.strip().lower() == company_state.strip().lower()

    if is_intrastate:
        half_rate = item.gst_rate / 2
        cgst = round_line_tax(taxable_value * half_rate / 100)
        sgst = round_line_tax(taxable_value * half_rate / 100)
        return TaxBreakdown(
            taxable_value=taxable_value,
            cgst_rate=half_rate,
            sgst_rate=half_rate,
            igst_rate=Decimal("0"),
            cgst_amount=cgst,
            sgst_amount=sgst,
            igst_amount=Decimal("0"),
        )

    igst = round_line_tax(taxable_value * item.gst_rate / 100)
    return TaxBreakdown(
        taxable_value=taxable_value,
        cgst_rate=Decimal("0"),
        sgst_rate=Decimal("0"),
        igst_rate=item.gst_rate,
        cgst_amount=Decimal("0"),
        sgst_amount=Decimal("0"),
        igst_amount=igst,
    )
