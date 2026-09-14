from decimal import Decimal

from pydantic import BaseModel


class ReportDatasetField(BaseModel):
    key: str
    label: str


class ReportMetricField(ReportDatasetField):
    # Lets the frontend format a value as INR vs a plain number without
    # guessing from the metric's key -- a qty/count-shaped metric added
    # to a new dataset would otherwise need a matching frontend edit.
    is_currency: bool = True


class ReportDatasetInfo(BaseModel):
    key: str
    label: str
    group_by_options: list[ReportDatasetField]
    metric_options: list[ReportMetricField]


class ReportRow(BaseModel):
    group: str
    value: Decimal


class ReportResult(BaseModel):
    dataset: str
    group_by: str
    metric: str
    rows: list[ReportRow]
