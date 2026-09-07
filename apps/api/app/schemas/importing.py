import uuid
from typing import Any

from pydantic import BaseModel


class ImportBatchOut(BaseModel):
    id: uuid.UUID
    source_type: str
    status: str
    file_name: str
    column_mapping: dict[str, Any] | None
    summary: dict[str, Any] | None
    error_report: dict[str, Any] | None

    class Config:
        from_attributes = True


class ColumnMappingRequest(BaseModel):
    """CSV imports (Busy/Marg) need explicit column -> field mapping.
    Tally XML has a fixed structure and skips this step (mapping is a
    no-op there -- see services/importing/pipeline.py).
    """

    row_type: str  # "customer" | "supplier" | "item" | "opening_balance"
    mapping: dict[str, str]  # target field -> source column name


class ImportBatchRowOut(BaseModel):
    id: uuid.UUID
    row_type: str
    row_index: int
    mapped_data: dict[str, Any] | None
    validation_errors: list[Any] | None
    is_valid: bool
    action: str

    class Config:
        from_attributes = True


class ImportPreviewResponse(BaseModel):
    batch: ImportBatchOut
    counts_by_row_type: dict[str, int]
    invalid_row_count: int
    sample_rows: list[ImportBatchRowOut]


class ImportCommitResponse(BaseModel):
    batch: ImportBatchOut
    customers_created: int
    suppliers_created: int
    items_created: int
    opening_stock_lines: int
