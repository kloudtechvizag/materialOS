"""A bounded report builder: a small, fixed catalog of datasets, each
with an allowlisted set of group-by columns and metrics. This is
deliberately NOT a general query builder over arbitrary tables/columns
-- there is no way to reach anything outside DATASETS from the API
surface, so there's no injection surface and no risk of leaking a
column a role shouldn't see. "Schedule" and "share" (named in the
product brief) are not implemented -- this ships table output + CSV
export only, and that gap is intentional rather than faked.
"""

import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.inventory import StockBalance
from app.models.masters import Customer, Item, Supplier
from app.models.procurement import PurchaseBill
from app.models.sales import Invoice
from app.models.tenant import Warehouse
from app.schemas.reports import ReportDatasetField, ReportDatasetInfo, ReportResult, ReportRow
from app.services.credit import compute_outstanding

_MONTH_FMT = "YYYY-MM"


class _Dataset:
    def __init__(self, key: str, label: str, permission: str, group_by: dict[str, str], metrics: dict[str, str]):
        self.key = key
        self.label = label
        self.permission = permission
        self.group_by = group_by  # {option_key: label}
        self.metrics = metrics  # {option_key: label}


DATASETS: dict[str, _Dataset] = {
    "sales_invoices": _Dataset(
        "sales_invoices", "Sales invoices", "customers.view",
        group_by={"customer": "Customer", "month": "Month", "status": "Status"},
        metrics={"total": "Total value", "count": "Invoice count"},
    ),
    "purchase_bills": _Dataset(
        "purchase_bills", "Purchase bills", "suppliers.view",
        group_by={"supplier": "Supplier", "month": "Month", "status": "Status"},
        metrics={"total": "Total value", "count": "Bill count"},
    ),
    "customer_outstanding": _Dataset(
        "customer_outstanding", "Customer outstanding", "customers.view",
        group_by={"customer": "Customer"},
        metrics={"outstanding": "Outstanding amount"},
    ),
    "item_stock": _Dataset(
        "item_stock", "Item stock on hand", "items.view",
        group_by={"item": "Item", "warehouse": "Warehouse"},
        metrics={"qty_on_hand": "Quantity on hand"},
    ),
}


def list_datasets() -> list[ReportDatasetInfo]:
    return [
        ReportDatasetInfo(
            key=ds.key,
            label=ds.label,
            group_by_options=[ReportDatasetField(key=k, label=v) for k, v in ds.group_by.items()],
            metric_options=[ReportDatasetField(key=k, label=v) for k, v in ds.metrics.items()],
        )
        for ds in DATASETS.values()
    ]


def get_dataset(dataset_key: str) -> _Dataset:
    ds = DATASETS.get(dataset_key)
    if ds is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown report dataset '{dataset_key}'")
    return ds


def _require_option(ds: _Dataset, options: dict[str, str], value: str, kind: str) -> None:
    if value not in options:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"'{value}' is not a valid {kind} for dataset '{ds.key}'")


def run_report(db: Session, *, tenant_id: uuid.UUID, dataset_key: str, group_by: str, metric: str) -> ReportResult:
    ds = get_dataset(dataset_key)
    _require_option(ds, ds.group_by, group_by, "group_by")
    _require_option(ds, ds.metrics, metric, "metric")

    if dataset_key == "sales_invoices":
        rows = _sales_invoices(db, group_by, metric)
    elif dataset_key == "purchase_bills":
        rows = _purchase_bills(db, group_by, metric)
    elif dataset_key == "customer_outstanding":
        rows = _customer_outstanding(db)
    elif dataset_key == "item_stock":
        rows = _item_stock(db, group_by)
    else:  # pragma: no cover -- unreachable, get_dataset() already validated dataset_key
        raise AppError(ErrorCode.VALIDATION_ERROR, f"Unknown report dataset '{dataset_key}'")

    return ReportResult(dataset=dataset_key, group_by=group_by, metric=metric, rows=rows)


def _metric_expr(metric: str, total_col):
    return func.count().label("value") if metric == "count" else func.coalesce(func.sum(total_col), 0).label("value")


def _sales_invoices(db: Session, group_by: str, metric: str) -> list[ReportRow]:
    value_expr = _metric_expr(metric, Invoice.total)
    if group_by == "customer":
        stmt = (
            select(Customer.name.label("group"), value_expr)
            .join(Customer, Customer.id == Invoice.customer_id)
            .group_by(Customer.name)
            .order_by(value_expr.desc())
        )
    elif group_by == "month":
        month_expr = func.to_char(Invoice.invoice_date, _MONTH_FMT).label("group")
        stmt = select(month_expr, value_expr).group_by(month_expr).order_by(month_expr)
    else:  # status
        stmt = select(Invoice.status.label("group"), value_expr).group_by(Invoice.status).order_by(Invoice.status)
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _purchase_bills(db: Session, group_by: str, metric: str) -> list[ReportRow]:
    value_expr = _metric_expr(metric, PurchaseBill.total)
    if group_by == "supplier":
        stmt = (
            select(Supplier.name.label("group"), value_expr)
            .join(Supplier, Supplier.id == PurchaseBill.supplier_id)
            .group_by(Supplier.name)
            .order_by(value_expr.desc())
        )
    elif group_by == "month":
        month_expr = func.to_char(PurchaseBill.bill_date, _MONTH_FMT).label("group")
        stmt = select(month_expr, value_expr).group_by(month_expr).order_by(month_expr)
    else:  # status
        stmt = select(PurchaseBill.status.label("group"), value_expr).group_by(PurchaseBill.status).order_by(PurchaseBill.status)
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _customer_outstanding(db: Session) -> list[ReportRow]:
    customers = db.execute(select(Customer).where(Customer.is_active.is_(True)).order_by(Customer.name)).scalars().all()
    rows = [ReportRow(group=c.name, value=compute_outstanding(db, c.id)) for c in customers]
    return [r for r in rows if r.value != 0]


def _item_stock(db: Session, group_by: str) -> list[ReportRow]:
    if group_by == "item":
        stmt = (
            select(Item.name.label("group"), func.coalesce(func.sum(StockBalance.qty_on_hand), 0).label("value"))
            .join(Item, Item.id == StockBalance.item_id)
            .group_by(Item.name)
            .having(func.coalesce(func.sum(StockBalance.qty_on_hand), 0) != 0)
            .order_by(Item.name)
        )
    else:  # warehouse
        stmt = (
            select(Warehouse.name.label("group"), func.coalesce(func.sum(StockBalance.qty_on_hand), 0).label("value"))
            .join(Warehouse, Warehouse.id == StockBalance.warehouse_id)
            .group_by(Warehouse.name)
            .having(func.coalesce(func.sum(StockBalance.qty_on_hand), 0) != 0)
            .order_by(Warehouse.name)
        )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]
