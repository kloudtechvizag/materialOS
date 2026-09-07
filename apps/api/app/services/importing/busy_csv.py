"""Busy/Marg export columns are not standardised the way Tally XML is, so
this module only detects columns and offers a best-guess mapping; the
user confirms or corrects it at the 'map columns' pipeline step before
anything is validated or previewed.
"""

import csv
import io

from app.services.importing.common import StagedRow

FIELD_GUESSES: dict[str, list[str]] = {
    "name": ["name", "ledger name", "party name", "item name", "product name"],
    "gstin": ["gstin", "gst no", "gst number"],
    "phone": ["mobile", "mobile no", "phone", "contact no"],
    "opening_balance": ["opening balance", "op. balance", "opening bal"],
    "base_uom": ["unit", "uom", "base unit"],
    "hsn_code": ["hsn", "hsn code", "hsn/sac"],
    "gst_rate": ["gst rate", "gst %", "tax rate"],
    "opening_qty": ["opening qty", "opening stock", "op. qty"],
    "opening_rate": ["opening rate", "op. rate", "rate"],
}


def sniff_columns(file_bytes: bytes) -> list[str]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    header = next(reader, [])
    return [h.strip() for h in header]


def guess_mapping(columns: list[str]) -> dict[str, str]:
    normalized = {c.lower().strip(): c for c in columns}
    mapping: dict[str, str] = {}
    for target, candidates in FIELD_GUESSES.items():
        for candidate in candidates:
            if candidate in normalized:
                mapping[target] = normalized[candidate]
                break
    return mapping


def read_rows(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return [{k.strip() if k else k: v for k, v in row.items()} for row in reader]


def apply_mapping(raw_rows: list[dict], *, row_type: str, mapping: dict[str, str]) -> list[StagedRow]:
    staged: list[StagedRow] = []
    for raw in raw_rows:
        mapped = {target: raw.get(source) for target, source in mapping.items()}
        if row_type in ("customer", "supplier"):
            mapped.setdefault("source_ledger_name", mapped.get("name"))
        elif row_type == "item":
            mapped.setdefault("sku", mapped.get("name"))
            mapped.setdefault("source_stock_item_name", mapped.get("name"))
        staged.append(StagedRow(row_type=row_type, raw=raw, mapped=mapped))
    return staged
