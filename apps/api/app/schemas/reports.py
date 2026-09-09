from decimal import Decimal

from pydantic import BaseModel


class ReportDatasetField(BaseModel):
    key: str
    label: str


class ReportDatasetInfo(BaseModel):
    key: str
    label: str
    group_by_options: list[ReportDatasetField]
    metric_options: list[ReportDatasetField]


class ReportRow(BaseModel):
    group: str
    value: Decimal


class ReportResult(BaseModel):
    dataset: str
    group_by: str
    metric: str
    rows: list[ReportRow]
