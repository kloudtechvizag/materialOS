"""The six-step import pipeline mandated by Slice 0 and dev.md §68:
upload -> detect format -> map columns -> validate -> preview diff ->
commit, with a downloadable error report. No import ever commits
without a preview (B-aligned: nothing silently mutates state).
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.importing import ImportBatch, ImportBatchRow
from app.models.inventory import StockLedger
from app.models.masters import Customer, Item, Supplier
from app.services.importing.busy_csv import apply_mapping as apply_csv_mapping
from app.services.importing.busy_csv import guess_mapping, read_rows, sniff_columns
from app.services.importing.common import VALIDATORS, StagedRow, parse_decimal
from app.services.importing.tally_xml import parse_tally_xml
from app.services.inventory import rebuild_stock_balance


def detect_format(file_name: str, file_bytes: bytes) -> str:
    lower = file_name.lower()
    if lower.endswith(".xml") or file_bytes.lstrip()[:1] == b"<":
        return "tally_xml"
    if lower.endswith(".csv"):
        return "busy_csv"
    raise AppError(
        ErrorCode.IMPORT_FORMAT_UNRECOGNISED,
        "Could not recognise the file as Tally XML or a Busy/Marg CSV export.",
        details={"file_name": file_name},
    )


def stage_tally_xml(db: Session, batch: ImportBatch, file_bytes: bytes) -> None:
    try:
        staged_rows = parse_tally_xml(file_bytes)
    except ValueError as exc:
        raise AppError(ErrorCode.IMPORT_FORMAT_UNRECOGNISED, str(exc)) from exc

    for idx, row in enumerate(staged_rows):
        db.add(
            ImportBatchRow(
                tenant_id=batch.tenant_id,
                import_batch_id=batch.id,
                row_type=row.row_type,
                row_index=idx,
                raw_data=row.raw,
                mapped_data=row.mapped,
                is_valid=True,
            )
        )
    batch.status = "mapped"  # Tally XML has a fixed structure -- no user mapping step needed
    db.flush()


def sniff_csv_columns(file_bytes: bytes) -> tuple[list[str], dict[str, str]]:
    columns = sniff_columns(file_bytes)
    return columns, guess_mapping(columns)


def apply_csv_column_mapping(
    db: Session, batch: ImportBatch, file_bytes: bytes, *, row_type: str, mapping: dict[str, str]
) -> None:
    raw_rows = read_rows(file_bytes)
    staged_rows = apply_csv_mapping(raw_rows, row_type=row_type, mapping=mapping)

    for idx, row in enumerate(staged_rows):
        db.add(
            ImportBatchRow(
                tenant_id=batch.tenant_id,
                import_batch_id=batch.id,
                row_type=row.row_type,
                row_index=idx,
                raw_data=row.raw,
                mapped_data=row.mapped,
                is_valid=True,
            )
        )
    batch.column_mapping = {row_type: mapping}
    batch.status = "mapped"
    db.flush()


def validate_batch(db: Session, batch: ImportBatch) -> None:
    rows = db.execute(
        select(ImportBatchRow).where(ImportBatchRow.import_batch_id == batch.id)
    ).scalars().all()

    invalid_count = 0
    for row in rows:
        staged = StagedRow(row_type=row.row_type, raw=row.raw_data, mapped=row.mapped_data)
        validator = VALIDATORS.get(row.row_type)
        if validator:
            validator(staged)
        row.is_valid = staged.is_valid
        row.validation_errors = [{"level": "error", "message": m} for m in staged.errors] + [
            {"level": "warning", "message": m} for m in staged.warnings
        ]
        if not staged.is_valid:
            invalid_count += 1

    batch.status = "validated"
    batch.error_report = {"invalid_row_count": invalid_count, "total_rows": len(rows)}
    db.flush()


def build_preview(db: Session, batch: ImportBatch) -> dict:
    rows = db.execute(
        select(ImportBatchRow).where(ImportBatchRow.import_batch_id == batch.id)
    ).scalars().all()

    counts: dict[str, int] = {}
    invalid = 0
    for row in rows:
        counts[row.row_type] = counts.get(row.row_type, 0) + 1
        if not row.is_valid:
            invalid += 1

    batch.summary = {"counts_by_row_type": counts, "invalid_row_count": invalid, "total_rows": len(rows)}
    batch.status = "previewed"
    db.flush()

    return {
        "counts_by_row_type": counts,
        "invalid_row_count": invalid,
        "sample_rows": rows[:20],
    }


def commit_batch(
    db: Session,
    batch: ImportBatch,
    *,
    company_id: uuid.UUID,
    default_warehouse_id: uuid.UUID | None,
    user_id: uuid.UUID,
) -> dict:
    if batch.status != "previewed":
        raise AppError(
            ErrorCode.IMPORT_VALIDATION_FAILED,
            "An import batch must be previewed before it can be committed.",
            details={"current_status": batch.status},
        )

    rows = db.execute(
        select(ImportBatchRow)
        .where(ImportBatchRow.import_batch_id == batch.id, ImportBatchRow.is_valid.is_(True))
    ).scalars().all()

    customers_created = suppliers_created = items_created = opening_stock_lines = 0
    now = datetime.now(timezone.utc)

    for row in rows:
        data = row.mapped_data or {}
        if row.row_type == "customer":
            db.add(
                Customer(
                    tenant_id=batch.tenant_id,
                    company_id=company_id,
                    name=data.get("name"),
                    gstin=data.get("gstin"),
                    phone=data.get("phone"),
                    opening_balance=parse_decimal(data.get("opening_balance"), default=Decimal("0")),
                    source_ledger_name=data.get("source_ledger_name"),
                )
            )
            customers_created += 1
        elif row.row_type == "supplier":
            db.add(
                Supplier(
                    tenant_id=batch.tenant_id,
                    company_id=company_id,
                    name=data.get("name"),
                    gstin=data.get("gstin"),
                    phone=data.get("phone"),
                    opening_balance=parse_decimal(data.get("opening_balance"), default=Decimal("0")),
                    source_ledger_name=data.get("source_ledger_name"),
                )
            )
            suppliers_created += 1
        elif row.row_type == "item":
            sku = (data.get("sku") or data.get("name") or f"IMPORT-{row.row_index}")[:50]
            item = Item(
                tenant_id=batch.tenant_id,
                company_id=company_id,
                sku=sku,
                name=data.get("name"),
                hsn_code=data.get("hsn_code"),
                gst_rate=parse_decimal(data.get("gst_rate"), default=Decimal("0")),
                base_uom=data.get("base_uom") or "NOS",
                source_stock_item_name=data.get("source_stock_item_name"),
            )
            db.add(item)
            db.flush()  # need item.id for the ledger line below
            items_created += 1

            opening_qty = parse_decimal(data.get("opening_qty"), default=Decimal("0"))
            opening_rate = parse_decimal(data.get("opening_rate"), default=Decimal("0"))
            if default_warehouse_id and opening_qty and opening_qty != 0:
                db.add(
                    StockLedger(
                        tenant_id=batch.tenant_id,
                        warehouse_id=default_warehouse_id,
                        item_id=item.id,
                        movement_type="opening",
                        qty=opening_qty,
                        rate=opening_rate,
                        value=opening_qty * opening_rate,
                        reference_type="import_batch",
                        reference_id=batch.id,
                        occurred_at=now,
                        created_by_user_id=user_id,
                    )
                )
                opening_stock_lines += 1

    db.flush()
    rebuild_stock_balance(db, tenant_id=batch.tenant_id)

    batch.status = "committed"
    batch.committed_at = now
    db.flush()

    return {
        "customers_created": customers_created,
        "suppliers_created": suppliers_created,
        "items_created": items_created,
        "opening_stock_lines": opening_stock_lines,
    }
