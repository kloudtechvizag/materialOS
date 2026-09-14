"""A bounded report builder: a small, fixed catalog of datasets, each
with an allowlisted set of group-by columns and metrics. This is
deliberately NOT a general query builder over arbitrary tables/columns
-- there is no way to reach anything outside DATASETS from the API
surface, so there's no injection surface and no risk of leaking a
column a role shouldn't see. "Schedule" and "share" (named in the
product brief) are not implemented -- this ships table output + CSV
export only, and that gap is intentional rather than faked.

Every dataset here is backed by a column that genuinely exists and is
populated today -- no salesperson-on-invoice, batch/serial, or GSTR-
filing-format datasets, because none of those have real backing data
(no salesperson FK on Invoice/SalesOrder, no batch/lot table, no GST
filing integration beyond the sandboxed e-invoice/e-way adapters).
"""

import uuid
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.errors import AppError, ErrorCode
from app.models.catalog import Category
from app.models.fleet import Trip, Vehicle
from app.models.inventory import StockBalance, StockLedger
from app.models.masters import Customer, Item, Supplier
from app.models.procurement import PurchaseBill, PurchaseBillItem, PurchaseOrder, PurchaseOrderItem
from app.models.projects import Project
from app.models.sales import DeliveryChallan, Invoice, InvoiceItem
from app.models.tenant import Branch, Warehouse
from app.schemas.reports import ReportDatasetField, ReportDatasetInfo, ReportMetricField, ReportResult, ReportRow
from app.services.credit import compute_outstanding, compute_supplier_outstanding

_MONTH_FMT = "YYYY-MM"
_NO_PROJECT = "No project"
_NO_HSN = "No HSN code"
_UNASSIGNED = "Unassigned"


class _Dataset:
    def __init__(
        self,
        key: str,
        label: str,
        permission: str,
        group_by: dict[str, str],
        metrics: dict[str, str],
        non_currency_metrics: frozenset[str] = frozenset(),
    ):
        self.key = key
        self.label = label
        self.permission = permission
        self.group_by = group_by  # {option_key: label}
        self.metrics = metrics  # {option_key: label}
        self.non_currency_metrics = non_currency_metrics


DATASETS: dict[str, _Dataset] = {
    "sales_invoices": _Dataset(
        "sales_invoices", "Sales invoices", "customers.view",
        group_by={"customer": "Customer", "month": "Month", "status": "Status", "branch": "Branch", "project": "Project"},
        metrics={"total": "Total value", "count": "Invoice count"},
    ),
    "sales_by_item": _Dataset(
        "sales_by_item", "Sales by item", "customers.view",
        group_by={"item": "Item"},
        metrics={"revenue": "Revenue", "qty": "Quantity sold", "margin": "Gross margin"},
        non_currency_metrics=frozenset({"qty"}),
    ),
    "purchase_bills": _Dataset(
        "purchase_bills", "Purchase bills", "suppliers.view",
        group_by={"supplier": "Supplier", "month": "Month", "status": "Status", "branch": "Branch"},
        metrics={"total": "Total value", "count": "Bill count"},
    ),
    "purchase_by_item": _Dataset(
        "purchase_by_item", "Purchases by item", "suppliers.view",
        group_by={"item": "Item", "category": "Category"},
        metrics={"total": "Total value", "qty": "Quantity purchased"},
        non_currency_metrics=frozenset({"qty"}),
    ),
    "pending_purchase_orders": _Dataset(
        "pending_purchase_orders", "Pending purchase orders", "suppliers.view",
        group_by={"supplier": "Supplier", "item": "Item"},
        metrics={"pending_qty": "Quantity pending receipt"},
        non_currency_metrics=frozenset({"pending_qty"}),
    ),
    "customer_outstanding": _Dataset(
        "customer_outstanding", "Customer outstanding", "customers.view",
        group_by={"customer": "Customer"},
        metrics={"outstanding": "Outstanding amount"},
    ),
    "supplier_outstanding": _Dataset(
        "supplier_outstanding", "Supplier outstanding (payables)", "suppliers.view",
        group_by={"supplier": "Supplier"},
        metrics={"outstanding": "Outstanding amount"},
    ),
    "item_stock": _Dataset(
        "item_stock", "Item stock on hand", "items.view",
        group_by={"item": "Item", "warehouse": "Warehouse"},
        metrics={"qty_on_hand": "Quantity on hand", "value": "Stock value"},
        non_currency_metrics=frozenset({"qty_on_hand"}),
    ),
    "low_stock": _Dataset(
        "low_stock", "Low stock (below reorder level)", "items.view",
        group_by={"item": "Item"},
        metrics={"shortfall": "Units below reorder level"},
        non_currency_metrics=frozenset({"shortfall"}),
    ),
    "stock_movement": _Dataset(
        "stock_movement", "Stock movement", "items.view",
        group_by={"item": "Item", "month": "Month"},
        metrics={"qty_in": "Quantity in", "qty_out": "Quantity out"},
        non_currency_metrics=frozenset({"qty_in", "qty_out"}),
    ),
    "hsn_tax_summary": _Dataset(
        "hsn_tax_summary", "HSN-wise tax summary", "items.view",
        group_by={"hsn": "HSN code"},
        metrics={"taxable_value": "Taxable value", "tax": "Tax amount"},
    ),
    "deliveries": _Dataset(
        "deliveries", "Deliveries", "customers.view",
        group_by={"vehicle": "Vehicle", "status": "Status"},
        metrics={"count": "Delivery count"},
        non_currency_metrics=frozenset({"count"}),
    ),
}


def list_datasets() -> list[ReportDatasetInfo]:
    return [
        ReportDatasetInfo(
            key=ds.key,
            label=ds.label,
            group_by_options=[ReportDatasetField(key=k, label=v) for k, v in ds.group_by.items()],
            metric_options=[
                ReportMetricField(key=k, label=v, is_currency=k not in ds.non_currency_metrics)
                for k, v in ds.metrics.items()
            ],
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
    elif dataset_key == "sales_by_item":
        rows = _sales_by_item(db, metric)
    elif dataset_key == "purchase_bills":
        rows = _purchase_bills(db, group_by, metric)
    elif dataset_key == "purchase_by_item":
        rows = _purchase_by_item(db, group_by, metric)
    elif dataset_key == "pending_purchase_orders":
        rows = _pending_purchase_orders(db, group_by)
    elif dataset_key == "customer_outstanding":
        rows = _customer_outstanding(db)
    elif dataset_key == "supplier_outstanding":
        rows = _supplier_outstanding(db)
    elif dataset_key == "item_stock":
        rows = _item_stock(db, group_by, metric)
    elif dataset_key == "low_stock":
        rows = _low_stock(db)
    elif dataset_key == "stock_movement":
        rows = _stock_movement(db, group_by, metric)
    elif dataset_key == "hsn_tax_summary":
        rows = _hsn_tax_summary(db, metric)
    elif dataset_key == "deliveries":
        rows = _deliveries(db, group_by)
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
    elif group_by == "branch":
        stmt = (
            select(Branch.name.label("group"), value_expr)
            .join(Branch, Branch.id == Invoice.branch_id)
            .group_by(Branch.name)
            .order_by(value_expr.desc())
        )
    elif group_by == "project":
        project_expr = func.coalesce(Project.name, _NO_PROJECT).label("group")
        stmt = (
            select(project_expr, value_expr)
            .select_from(Invoice)
            .outerjoin(Project, Project.id == Invoice.project_id)
            .group_by(project_expr)
            .order_by(value_expr.desc())
        )
    else:  # status
        stmt = select(Invoice.status.label("group"), value_expr).group_by(Invoice.status).order_by(Invoice.status)
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _sales_by_item(db: Session, metric: str) -> list[ReportRow]:
    if metric == "revenue":
        value_expr = func.coalesce(func.sum(InvoiceItem.line_total), 0).label("value")
    elif metric == "qty":
        value_expr = func.coalesce(func.sum(InvoiceItem.qty), 0).label("value")
    else:  # margin -- taxable_value already excludes tax, cost is the per-unit standard_cost snapshotted at sale time
        value_expr = func.coalesce(func.sum(InvoiceItem.taxable_value - InvoiceItem.qty * InvoiceItem.cost), 0).label("value")
    stmt = (
        select(Item.name.label("group"), value_expr)
        .join(Item, Item.id == InvoiceItem.item_id)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.status == "posted")
        .group_by(Item.name)
        .order_by(value_expr.desc())
    )
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
    elif group_by == "branch":
        stmt = (
            select(Branch.name.label("group"), value_expr)
            .join(Branch, Branch.id == PurchaseBill.branch_id)
            .group_by(Branch.name)
            .order_by(value_expr.desc())
        )
    else:  # status
        stmt = select(PurchaseBill.status.label("group"), value_expr).group_by(PurchaseBill.status).order_by(PurchaseBill.status)
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _purchase_by_item(db: Session, group_by: str, metric: str) -> list[ReportRow]:
    value_expr = (
        func.coalesce(func.sum(PurchaseBillItem.line_total), 0).label("value")
        if metric == "total"
        else func.coalesce(func.sum(PurchaseBillItem.qty), 0).label("value")
    )
    if group_by == "item":
        stmt = (
            select(Item.name.label("group"), value_expr)
            .join(Item, Item.id == PurchaseBillItem.item_id)
            .group_by(Item.name)
            .order_by(value_expr.desc())
        )
    else:  # category
        category_expr = func.coalesce(Category.name, "Uncategorised").label("group")
        stmt = (
            select(category_expr, value_expr)
            .select_from(PurchaseBillItem)
            .join(Item, Item.id == PurchaseBillItem.item_id)
            .outerjoin(Category, Category.id == Item.category_id)
            .group_by(category_expr)
            .order_by(value_expr.desc())
        )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _pending_purchase_orders(db: Session, group_by: str) -> list[ReportRow]:
    pending_expr = func.coalesce(func.sum(PurchaseOrderItem.qty - PurchaseOrderItem.qty_received), 0).label("value")
    base = (
        select(pending_expr)
        .select_from(PurchaseOrderItem)
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
        .where(PurchaseOrder.status.in_(["approved", "partially_received"]))
    )
    if group_by == "supplier":
        stmt = (
            base.add_columns(Supplier.name.label("group"))
            .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
            .group_by(Supplier.name)
            .having(pending_expr > 0)
            .order_by(pending_expr.desc())
        )
    else:  # item
        stmt = (
            base.add_columns(Item.name.label("group"))
            .join(Item, Item.id == PurchaseOrderItem.item_id)
            .group_by(Item.name)
            .having(pending_expr > 0)
            .order_by(pending_expr.desc())
        )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _customer_outstanding(db: Session) -> list[ReportRow]:
    customers = db.execute(select(Customer).where(Customer.is_active.is_(True)).order_by(Customer.name)).scalars().all()
    rows = [ReportRow(group=c.name, value=compute_outstanding(db, c.id)) for c in customers]
    return [r for r in rows if r.value != 0]


def _supplier_outstanding(db: Session) -> list[ReportRow]:
    suppliers = db.execute(select(Supplier).where(Supplier.is_active.is_(True)).order_by(Supplier.name)).scalars().all()
    rows = [ReportRow(group=s.name, value=compute_supplier_outstanding(db, s.id)) for s in suppliers]
    return [r for r in rows if r.value != 0]


def _item_stock(db: Session, group_by: str, metric: str) -> list[ReportRow]:
    value_expr = (
        func.coalesce(func.sum(StockBalance.qty_on_hand), 0).label("value")
        if metric == "qty_on_hand"
        else func.coalesce(func.sum(StockBalance.qty_on_hand * Item.standard_cost), 0).label("value")
    )
    if group_by == "item":
        stmt = (
            select(Item.name.label("group"), value_expr)
            .select_from(StockBalance)
            .join(Item, Item.id == StockBalance.item_id)
            .group_by(Item.name)
            .having(value_expr != 0)
            .order_by(Item.name)
        )
    else:  # warehouse
        stmt = (
            select(Warehouse.name.label("group"), value_expr)
            .select_from(StockBalance)
            .join(Warehouse, Warehouse.id == StockBalance.warehouse_id)
            .join(Item, Item.id == StockBalance.item_id)
            .group_by(Warehouse.name)
            .having(value_expr != 0)
            .order_by(Warehouse.name)
        )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _low_stock(db: Session) -> list[ReportRow]:
    # Aggregate qty_on_hand across every warehouse for an item before
    # comparing to its single, warehouse-independent reorder_level.
    shortfall_expr = (Item.reorder_level - func.coalesce(func.sum(StockBalance.qty_on_hand), 0)).label("value")
    stmt = (
        select(Item.name.label("group"), shortfall_expr)
        .select_from(Item)
        .outerjoin(StockBalance, StockBalance.item_id == Item.id)
        .where(Item.reorder_level.isnot(None))
        .group_by(Item.id, Item.name, Item.reorder_level)
        .having((Item.reorder_level - func.coalesce(func.sum(StockBalance.qty_on_hand), 0)) > 0)
        .order_by(shortfall_expr.desc())
    )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _stock_movement(db: Session, group_by: str, metric: str) -> list[ReportRow]:
    signed_col = StockLedger.qty
    if metric == "qty_in":
        value_expr = func.coalesce(func.sum(case((signed_col > 0, signed_col), else_=0)), 0).label("value")
    else:  # qty_out
        value_expr = func.coalesce(func.sum(case((signed_col < 0, -signed_col), else_=0)), 0).label("value")
    if group_by == "item":
        stmt = (
            select(Item.name.label("group"), value_expr)
            .join(Item, Item.id == StockLedger.item_id)
            .group_by(Item.name)
            .having(value_expr != 0)
            .order_by(value_expr.desc())
        )
    else:  # month
        month_expr = func.to_char(StockLedger.occurred_at, _MONTH_FMT).label("group")
        stmt = select(month_expr, value_expr).group_by(month_expr).order_by(month_expr)
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _hsn_tax_summary(db: Session, metric: str) -> list[ReportRow]:
    hsn_expr = func.coalesce(Item.hsn_code, _NO_HSN).label("group")
    if metric == "taxable_value":
        value_expr = func.coalesce(func.sum(InvoiceItem.taxable_value), 0).label("value")
    else:  # tax
        value_expr = func.coalesce(
            func.sum(InvoiceItem.cgst_amount + InvoiceItem.sgst_amount + InvoiceItem.igst_amount), 0
        ).label("value")
    stmt = (
        select(hsn_expr, value_expr)
        .select_from(InvoiceItem)
        .join(Item, Item.id == InvoiceItem.item_id)
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(Invoice.status == "posted")
        .group_by(hsn_expr)
        .order_by(value_expr.desc())
    )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]


def _deliveries(db: Session, group_by: str) -> list[ReportRow]:
    value_expr = func.count().label("value")
    if group_by == "status":
        stmt = select(DeliveryChallan.status.label("group"), value_expr).group_by(DeliveryChallan.status).order_by(DeliveryChallan.status)
    else:  # vehicle
        vehicle_expr = func.coalesce(Vehicle.registration_number, _UNASSIGNED).label("group")
        stmt = (
            select(vehicle_expr, value_expr)
            .select_from(DeliveryChallan)
            .outerjoin(Trip, Trip.id == DeliveryChallan.trip_id)
            .outerjoin(Vehicle, Vehicle.id == Trip.vehicle_id)
            .group_by(vehicle_expr)
            .order_by(value_expr.desc())
        )
    return [ReportRow(group=r.group, value=r.value) for r in db.execute(stmt).all()]
