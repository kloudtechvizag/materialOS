"""B1: money is never a float. This is a property test on the rounding
primitives in app/services/money.py -- the full "10,000 random invoices,
line amounts + tax - discounts == header total exactly" test belongs to
Slice 1's invoice module, which does not exist yet. What's testable now
is that Decimal arithmetic and B13's rounding rule never drift, which is
the foundation that invariant will be built on.
"""

from decimal import Decimal

from hypothesis import given
from hypothesis import strategies as st

from app.services.money import round_invoice_total, round_line_tax

money_amounts = st.decimals(
    min_value=Decimal("0.0001"), max_value=Decimal("10000000"), places=4, allow_nan=False, allow_infinity=False
)


@given(st.lists(money_amounts, min_size=1, max_size=50))
def test_sum_of_rounded_lines_plus_round_off_equals_rounded_total(amounts: list[Decimal]):
    exact_total = sum(amounts)
    rounded_lines = [round_line_tax(a) for a in amounts]
    rounded_total, round_off = round_invoice_total(sum(rounded_lines))

    # The defining property of B13: nothing is lost silently -- the
    # rounding difference is always fully accounted for.
    assert rounded_total == sum(rounded_lines) + round_off


@given(money_amounts)
def test_round_off_is_always_less_than_half_a_rupee(amount: Decimal):
    _, round_off = round_invoice_total(amount)
    assert abs(round_off) < Decimal("0.5") or abs(round_off) == Decimal("0.5")


@given(money_amounts)
def test_rounding_is_idempotent(amount: Decimal):
    once = round_line_tax(amount)
    twice = round_line_tax(once)
    assert once == twice


def test_no_float_ever_appears_in_money_helpers():
    result = round_line_tax(Decimal("100.005"))
    assert isinstance(result, Decimal)
    rounded, off = round_invoice_total(Decimal("1234.56"))
    assert isinstance(rounded, Decimal)
    assert isinstance(off, Decimal)
