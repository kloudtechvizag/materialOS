"""Parses a Tally 'Masters' XML export (LEDGER + STOCKITEM messages).

Scope note: Slice 0's acceptance test only needs opening balances and
opening stock to reconcile -- it does not require replaying Tally's
voucher history. Vouchers (sales/purchase/payment entries already in
Tally) are explicitly out of scope here; see Master Brief v2 Slice 0.

Tally's OPENINGBALANCE sign convention for Sundry Debtors/Creditors is
exported as the ledger keeps it (Dr positive by default in most exports).
We pass the value through as-is rather than re-deriving a sign, and flag
it for human review at the preview step rather than guessing.
"""

from io import BytesIO

from lxml import etree

from app.services.importing.common import StagedRow

DEBTOR_PARENTS = {"sundry debtors", "debtors"}
CREDITOR_PARENTS = {"sundry creditors", "creditors"}


def _text(el: etree._Element, tag: str) -> str | None:
    child = el.find(tag)
    if child is None or child.text is None:
        return None
    return child.text.strip()


def _parse_opening_balance_qty_rate(raw: str | None) -> tuple[str | None, str | None]:
    """Tally stores stock item opening balance as e.g. '500 BAGS' and
    opening rate as '350.00/BAGS'. Extract the numeric portion only.
    """
    if not raw:
        return None, None
    parts = raw.replace("/", " ").split()
    return (parts[0] if parts else None, None)


def parse_tally_xml(file_bytes: bytes) -> list[StagedRow]:
    parser = etree.XMLParser(recover=True, resolve_entities=False)
    try:
        root = etree.parse(BytesIO(file_bytes), parser=parser)
    except etree.XMLSyntaxError as exc:
        raise ValueError(f"Could not parse Tally XML: {exc}") from exc

    rows: list[StagedRow] = []

    for ledger in root.iter("LEDGER"):
        name = ledger.get("NAME") or _text(ledger, "NAME")
        parent = (_text(ledger, "PARENT") or "").strip().lower()
        opening_balance = _text(ledger, "OPENINGBALANCE") or "0"
        gstin = _text(ledger, "PARTYGSTIN") or _text(ledger, "GSTIN")
        phone = _text(ledger, "LEDGERMOBILE") or _text(ledger, "LEDGERPHONE")

        raw = {
            "name": name,
            "parent": parent,
            "opening_balance": opening_balance,
            "gstin": gstin,
            "phone": phone,
        }

        if parent in DEBTOR_PARENTS:
            row_type = "customer"
        elif parent in CREDITOR_PARENTS:
            row_type = "supplier"
        else:
            continue  # not a receivable/payable ledger -- out of Slice 0 scope

        row = StagedRow(row_type=row_type, raw=raw)
        row.mapped = {
            "name": name,
            "gstin": gstin,
            "phone": phone,
            "opening_balance": opening_balance,
            "source_ledger_name": name,
        }
        rows.append(row)

    for stock_item in root.iter("STOCKITEM"):
        name = stock_item.get("NAME") or _text(stock_item, "NAME")
        base_uom = _text(stock_item, "BASEUNITS")
        hsn_code = _text(stock_item, "GSTHSNCODE") or _text(stock_item, "HSNCODE")
        gst_rate = _text(stock_item, "GSTRATE") or _text(stock_item, "RATEOFVAT")
        opening_balance_raw = _text(stock_item, "OPENINGBALANCE")
        opening_rate_raw = _text(stock_item, "OPENINGRATE")

        opening_qty, _ = _parse_opening_balance_qty_rate(opening_balance_raw)
        opening_rate, _ = _parse_opening_balance_qty_rate(opening_rate_raw)

        raw = {
            "name": name,
            "base_uom": base_uom,
            "hsn_code": hsn_code,
            "gst_rate": gst_rate,
            "opening_balance": opening_balance_raw,
            "opening_rate": opening_rate_raw,
        }

        row = StagedRow(row_type="item", raw=raw)
        row.mapped = {
            "sku": name,
            "name": name,
            "base_uom": base_uom or "",
            "hsn_code": hsn_code,
            "gst_rate": gst_rate or "0",
            "opening_qty": opening_qty or "0",
            "opening_rate": opening_rate or "0",
            "source_stock_item_name": name,
        }
        rows.append(row)

    return rows
