"""B1 (money is never a float) and B13 (rounding is specified, not
incidental), in one place as the brief requires ("this rule appears in
exactly one module"). Every money value that reaches here or leaves here
is a Decimal -- never a Python float.
"""

from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")
WHOLE_RUPEE = Decimal("1")


def round_line_tax(amount: Decimal) -> Decimal:
    """Tax is computed per line at NUMERIC(18,4) and rounded to 2 decimals
    at the line (B13)."""
    return amount.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def round_invoice_total(amount: Decimal) -> tuple[Decimal, Decimal]:
    """Invoice total is rounded to the nearest rupee; the difference is
    posted to a Round Off ledger (B13). Returns (rounded_total, round_off).
    """
    rounded = amount.quantize(WHOLE_RUPEE, rounding=ROUND_HALF_UP)
    round_off = rounded - amount
    return rounded, round_off
