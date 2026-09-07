import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

GSTIN_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$")

CEMENT_HSN_PREFIXES = ("2523",)
CURRENT_CEMENT_GST_RATE = Decimal("18")  # D1: effective 2025-09-22, was 28%


@dataclass
class StagedRow:
    row_type: str  # customer | supplier | item | opening_balance
    raw: dict
    mapped: dict | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0


def parse_decimal(value, *, default: Decimal | None = Decimal("0")) -> Decimal | None:
    if value is None or value == "":
        return default
    try:
        cleaned = str(value).replace(",", "").strip()
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def validate_gstin(gstin: str | None) -> str | None:
    if not gstin:
        return None
    if not GSTIN_RE.match(gstin.strip().upper()):
        return f"GSTIN '{gstin}' does not match the standard 15-character format."
    return None


def validate_customer_or_supplier(row: StagedRow) -> None:
    name = (row.mapped or {}).get("name", "").strip()
    if not name:
        row.errors.append("Name is required.")

    gstin = (row.mapped or {}).get("gstin")
    gstin_error = validate_gstin(gstin)
    if gstin_error:
        row.errors.append(gstin_error)

    opening_balance = parse_decimal((row.mapped or {}).get("opening_balance"), default=Decimal("0"))
    if opening_balance is None:
        row.errors.append("Opening balance is not a valid number.")


def validate_item(row: StagedRow) -> None:
    mapped = row.mapped or {}
    name = mapped.get("name", "").strip()
    if not name:
        row.errors.append("Item name is required.")

    if not mapped.get("base_uom", "").strip():
        row.errors.append("Base unit of measure is required.")

    gst_rate = parse_decimal(mapped.get("gst_rate"), default=Decimal("0"))
    if gst_rate is None:
        row.errors.append("GST rate is not a valid number.")

    hsn = (mapped.get("hsn_code") or "").strip()
    if not hsn:
        row.warnings.append("No HSN code -- required before this item can be invoiced (D1).")
    elif hsn.startswith(CEMENT_HSN_PREFIXES) and gst_rate is not None and gst_rate != CURRENT_CEMENT_GST_RATE:
        row.warnings.append(
            f"HSN {hsn} (cement) is taxed at 18% since 2025-09-22 (GST 2.0); "
            f"imported rate is {gst_rate}%. Verify before invoicing."
        )

    opening_qty = parse_decimal(mapped.get("opening_qty"), default=Decimal("0"))
    if opening_qty is None:
        row.errors.append("Opening quantity is not a valid number.")

    opening_rate = parse_decimal(mapped.get("opening_rate"), default=Decimal("0"))
    if opening_rate is None:
        row.errors.append("Opening rate is not a valid number.")


VALIDATORS = {
    "customer": validate_customer_or_supplier,
    "supplier": validate_customer_or_supplier,
    "item": validate_item,
}
