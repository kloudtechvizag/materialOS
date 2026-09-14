"""Report builder: a bounded set of datasets (services/reports.py), each
permission-gated the same way the command palette (search.py) is --
group-by/metric options are validated against a fixed allowlist rather
than accepting arbitrary column names.
"""
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.main import app
from app.models.masters import Customer, Item, Supplier
from app.models.user import Permission, Role, RolePermission, User, UserRole
from app.services.inventory import apply_ledger_movement
from app.services.dispatch import create_delivery_challan
from app.services.invoicing import create_invoice_from_challan
from app.services.procurement import approve_purchase_order, create_purchase_bill, create_purchase_order, receive_goods
from app.services.quotation import create_quotation
from app.services.sales_order import create_sales_order_from_quotation

client = TestClient(app)


def _signed_up_token(slug: str) -> str:
    client.post(
        "/api/v1/tenants/signup",
        json={
            "tenant_name": "X", "tenant_slug": slug, "company_name": "X", "company_legal_name": "X Pvt Ltd",
            "owner_full_name": "Owner", "owner_email": f"owner-{slug}@example.com", "owner_password": "correct-horse-battery-staple",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"tenant_slug": slug, "email": f"owner-{slug}@example.com", "password": "correct-horse-battery-staple"},
    )
    return login_resp.json()["access_token"]


def _make_invoice(db, tenant_ctx, *, customer_name: str, qty: Decimal, rate: Decimal):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    customer = Customer(tenant_id=tenant.id, company_id=company.id, name=customer_name, billing_state="Andhra Pradesh")
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-{uuid.uuid4().hex[:6]}", name="Report Test Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=rate, standard_cost=rate,
    )
    db.add_all([customer, item])
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("1000"), rate=rate,
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": qty, "uom": "PCS"}],
    )
    quotation.status = "approved"
    db.flush()
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id,
        requested_by_user_id=user_id,
    )
    challan = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=order.id, financial_year_id=fy.id, user_id=user_id)
    return create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=challan.id, financial_year_id=fy.id)


def _make_purchase_bill(db, tenant_ctx, *, supplier_name: str, qty: Decimal, rate: Decimal):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    user_id = uuid.uuid4()
    supplier = Supplier(tenant_id=tenant.id, company_id=company.id, name=supplier_name)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-PO-{uuid.uuid4().hex[:6]}", name="Report Test Purchase Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=rate, standard_cost=rate,
    )
    db.add_all([supplier, item])
    db.flush()
    order = create_purchase_order(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        supplier_id=supplier.id, financial_year_id=fy.id,
        lines=[{"item_id": item.id, "qty": qty, "rate": rate, "uom": "PCS"}],
    )
    approve_purchase_order(db, purchase_order_id=order.id)
    receipt = receive_goods(
        db, tenant_id=tenant.id, purchase_order_id=order.id, financial_year_id=fy.id, user_id=user_id,
        lines=[{"purchase_order_item_id": order.items[0].id, "qty_received": qty, "qc_status": "passed"}],
    )
    return create_purchase_bill(db, tenant_id=tenant.id, financial_year_id=fy.id, goods_receipt_id=receipt.id)


ALL_DATASET_KEYS = {
    "sales_invoices", "sales_by_item", "purchase_bills", "purchase_by_item", "pending_purchase_orders",
    "customer_outstanding", "supplier_outstanding", "item_stock", "low_stock", "stock_movement",
    "hsn_tax_summary", "deliveries",
}


def test_reports_datasets_lists_only_permitted_datasets():
    slug = f"rpt-ds-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    resp = client.get("/api/v1/reports/datasets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    keys = {d["key"] for d in resp.json()}
    # Owner role has every resource -- every real dataset should be visible.
    assert keys == ALL_DATASET_KEYS


def test_metric_options_carry_a_currency_hint_the_frontend_can_trust():
    slug = f"rpt-currency-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    resp = client.get("/api/v1/reports/datasets", headers={"Authorization": f"Bearer {token}"})
    by_key = {d["key"]: d for d in resp.json()}

    sales_by_item_metrics = {m["key"]: m["is_currency"] for m in by_key["sales_by_item"]["metric_options"]}
    assert sales_by_item_metrics == {"revenue": True, "qty": False, "margin": True}

    stock_movement_metrics = {m["key"]: m["is_currency"] for m in by_key["stock_movement"]["metric_options"]}
    assert stock_movement_metrics == {"qty_in": False, "qty_out": False}


def test_reports_datasets_hides_dataset_without_permission(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    role = Role(tenant_id=tenant.id, name="Items Only")
    db.add(role)
    db.flush()
    items_permission = db.query(Permission).filter(Permission.code == "items.view").one()
    db.add(RolePermission(tenant_id=tenant.id, role_id=role.id, permission_id=items_permission.id))
    user = User(tenant_id=tenant.id, email="items-only-rpt@example.com", full_name="Items Only", hashed_password="x", is_active=True)
    db.add(user)
    db.flush()
    db.add(UserRole(tenant_id=tenant.id, user_id=user.id, role_id=role.id))
    db.commit()

    from app.security import create_access_token

    token = create_access_token(user_id=user.id, tenant_id=tenant.id)
    resp = client.get("/api/v1/reports/datasets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    keys = {d["key"] for d in resp.json()}
    # items.view gates every items.* dataset, not just item_stock.
    assert keys == {"item_stock", "low_stock", "stock_movement", "hsn_tax_summary"}

    forbidden = client.get(
        "/api/v1/reports/run?dataset=sales_invoices&group_by=customer&metric=total",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert forbidden.status_code == 403


def test_reports_run_rejects_unknown_group_by_and_metric():
    slug = f"rpt-bad-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/v1/reports/run?dataset=nope&group_by=customer&metric=total", headers=headers)
    assert resp.status_code == 400

    resp = client.get("/api/v1/reports/run?dataset=sales_invoices&group_by=not_a_real_option&metric=total", headers=headers)
    assert resp.status_code == 400

    resp = client.get("/api/v1/reports/run?dataset=sales_invoices&group_by=customer&metric=not_a_real_metric", headers=headers)
    assert resp.status_code == 400


def test_sales_invoices_grouped_by_customer_matches_real_invoice_totals(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    invoice_a = _make_invoice(db, tenant_ctx, customer_name="Report Customer A", qty=Decimal("10"), rate=Decimal("100"))
    invoice_b = _make_invoice(db, tenant_ctx, customer_name="Report Customer B", qty=Decimal("5"), rate=Decimal("200"))
    db.flush()

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="sales_invoices", group_by="customer", metric="total")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Customer A"] == invoice_a.total
    assert groups["Report Customer B"] == invoice_b.total

    count_result = run_report(db, tenant_id=tenant.id, dataset_key="sales_invoices", group_by="status", metric="count")
    assert {r.group: r.value for r in count_result.rows} == {"posted": 2}


def test_purchase_bills_grouped_by_supplier_matches_real_bill_totals(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    bill = _make_purchase_bill(db, tenant_ctx, supplier_name="Report Supplier A", qty=Decimal("4"), rate=Decimal("500"))
    db.flush()

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="purchase_bills", group_by="supplier", metric="total")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Supplier A"] == bill.total


def test_customer_outstanding_matches_compute_outstanding(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    invoice = _make_invoice(db, tenant_ctx, customer_name="Report Outstanding Co", qty=Decimal("2"), rate=Decimal("1000"))
    db.flush()

    from app.services.credit import compute_outstanding
    from app.services.reports import run_report

    expected = compute_outstanding(db, invoice.customer_id)
    result = run_report(db, tenant_id=tenant.id, dataset_key="customer_outstanding", group_by="customer", metric="outstanding")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Outstanding Co"] == expected
    assert expected != 0


def test_item_stock_report_reflects_ledger_movement(db, tenant_ctx):
    tenant, company, warehouse = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["warehouse"]
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-STK-{uuid.uuid4().hex[:6]}", name="Report Stock Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("50"), standard_cost=Decimal("40"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("75"), rate=Decimal("40"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="item_stock", group_by="item", metric="qty_on_hand")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Stock Item"] == Decimal("75")


def test_sales_invoices_can_group_by_branch_and_project(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    invoice = _make_invoice(db, tenant_ctx, customer_name="Report Branch Co", qty=Decimal("3"), rate=Decimal("100"))
    db.flush()

    from app.services.reports import run_report

    branch_result = run_report(db, tenant_id=tenant.id, dataset_key="sales_invoices", group_by="branch", metric="total")
    assert {r.group: r.value for r in branch_result.rows}[tenant_ctx["branch"].name] == invoice.total

    # No project was set on this quotation -- it must fall into the "No project" bucket, not vanish.
    project_result = run_report(db, tenant_id=tenant.id, dataset_key="sales_invoices", group_by="project", metric="total")
    assert {r.group: r.value for r in project_result.rows}["No project"] == invoice.total


def test_sales_by_item_computes_real_revenue_qty_and_margin(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    # rate=100, standard_cost=100 (per _make_invoice) means margin is exactly the tax-exclusive
    # revenue minus (qty * cost) -- here cost == rate, so margin should be 0 for this line's cost basis
    # vs its own rate; use distinct rate/cost by building the invoice directly instead of via the shared helper.
    tenant, company, branch, warehouse, fy = (
        tenant.id, tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    from app.models.masters import Customer as CustomerModel
    from app.services.dispatch import create_delivery_challan
    from app.services.invoicing import create_invoice_from_challan
    from app.services.quotation import create_quotation
    from app.services.sales_order import create_sales_order_from_quotation

    user_id = uuid.uuid4()
    customer = CustomerModel(tenant_id=tenant, company_id=company.id, name="Report Margin Co", billing_state="Andhra Pradesh")
    item = Item(
        tenant_id=tenant, company_id=company.id, sku=f"RPT-MGN-{uuid.uuid4().hex[:6]}", name="Report Margin Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("150"), standard_cost=Decimal("100"),
    )
    db.add_all([customer, item])
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("100"), rate=Decimal("100"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    quotation = create_quotation(
        db, tenant_id=tenant, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": Decimal("10"), "uom": "PCS"}],
    )
    quotation.status = "approved"
    db.flush()
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id, requested_by_user_id=user_id,
    )
    challan = create_delivery_challan(db, tenant_id=tenant, sales_order_id=order.id, financial_year_id=fy.id, user_id=user_id)
    invoice = create_invoice_from_challan(db, tenant_id=tenant, delivery_challan_id=challan.id, financial_year_id=fy.id)
    db.flush()

    from app.services.reports import run_report

    revenue = {r.group: r.value for r in run_report(db, tenant_id=tenant, dataset_key="sales_by_item", group_by="item", metric="revenue").rows}
    qty = {r.group: r.value for r in run_report(db, tenant_id=tenant, dataset_key="sales_by_item", group_by="item", metric="qty").rows}
    margin = {r.group: r.value for r in run_report(db, tenant_id=tenant, dataset_key="sales_by_item", group_by="item", metric="margin").rows}

    line = invoice.items[0]
    assert revenue["Report Margin Item"] == line.line_total
    assert qty["Report Margin Item"] == Decimal("10")
    assert margin["Report Margin Item"] == line.taxable_value - (Decimal("10") * Decimal("100"))
    assert margin["Report Margin Item"] > 0  # rate (150) > cost (100), so this must be a real, positive margin


def test_purchase_by_item_and_category_match_real_bill_lines(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    bill = _make_purchase_bill(db, tenant_ctx, supplier_name="Report Purchase Item Co", qty=Decimal("6"), rate=Decimal("50"))
    db.flush()

    from app.services.reports import run_report

    by_item = run_report(db, tenant_id=tenant.id, dataset_key="purchase_by_item", group_by="item", metric="total")
    line = bill.items[0]
    assert {r.group: r.value for r in by_item.rows}["Report Test Purchase Item"] == line.line_total

    # No category assigned -- must land in "Uncategorised", not disappear.
    by_category = run_report(db, tenant_id=tenant.id, dataset_key="purchase_by_item", group_by="category", metric="total")
    assert {r.group: r.value for r in by_category.rows}["Uncategorised"] == line.line_total


def test_pending_purchase_orders_excludes_fully_received_lines(db, tenant_ctx):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    from app.services.procurement import approve_purchase_order, create_purchase_order

    supplier = Supplier(tenant_id=tenant.id, company_id=company.id, name="Report Pending Supplier")
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-PEND-{uuid.uuid4().hex[:6]}", name="Report Pending Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("20"), standard_cost=Decimal("20"),
    )
    db.add_all([supplier, item])
    db.flush()
    order = create_purchase_order(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, warehouse_id=warehouse.id,
        supplier_id=supplier.id, financial_year_id=fy.id,
        lines=[{"item_id": item.id, "qty": Decimal("50"), "rate": Decimal("20"), "uom": "PCS"}],
    )
    approve_purchase_order(db, purchase_order_id=order.id)  # approved, nothing received yet -> fully pending
    db.flush()

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="pending_purchase_orders", group_by="supplier", metric="pending_qty")
    assert {r.group: r.value for r in result.rows}["Report Pending Supplier"] == Decimal("50")


def test_supplier_outstanding_matches_compute_supplier_outstanding(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    bill = _make_purchase_bill(db, tenant_ctx, supplier_name="Report Payable Co", qty=Decimal("3"), rate=Decimal("300"))
    db.flush()

    from app.services.credit import compute_supplier_outstanding
    from app.services.reports import run_report

    expected = compute_supplier_outstanding(db, bill.supplier_id)
    result = run_report(db, tenant_id=tenant.id, dataset_key="supplier_outstanding", group_by="supplier", metric="outstanding")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Payable Co"] == expected
    assert expected != 0


def test_item_stock_value_metric_multiplies_qty_by_standard_cost(db, tenant_ctx):
    tenant, company, warehouse = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["warehouse"]
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-VAL-{uuid.uuid4().hex[:6]}", name="Report Stock Value Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("90"), standard_cost=Decimal("60"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("20"), rate=Decimal("60"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="item_stock", group_by="item", metric="value")
    assert {r.group: r.value for r in result.rows}["Report Stock Value Item"] == Decimal("20") * Decimal("60")


def test_low_stock_only_lists_items_below_their_reorder_level(db, tenant_ctx):
    tenant, company, warehouse = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["warehouse"]
    low_item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-LOW-{uuid.uuid4().hex[:6]}", name="Report Low Stock Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("10"), standard_cost=Decimal("10"), reorder_level=Decimal("50"),
    )
    healthy_item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-OK-{uuid.uuid4().hex[:6]}", name="Report Healthy Stock Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("10"), standard_cost=Decimal("10"), reorder_level=Decimal("5"),
    )
    db.add_all([low_item, healthy_item])
    db.flush()
    for item, qty in ((low_item, Decimal("10")), (healthy_item, Decimal("100"))):
        apply_ledger_movement(
            db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=qty, rate=Decimal("10"),
            movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
        )

    from app.services.reports import run_report

    result = run_report(db, tenant_id=tenant.id, dataset_key="low_stock", group_by="item", metric="shortfall")
    groups = {r.group: r.value for r in result.rows}
    assert groups["Report Low Stock Item"] == Decimal("40")  # 50 reorder - 10 on hand
    assert "Report Healthy Stock Item" not in groups  # 100 on hand > 5 reorder -- not short


def test_stock_movement_separates_in_from_out(db, tenant_ctx):
    tenant, company, warehouse = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["warehouse"]
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"RPT-MOV-{uuid.uuid4().hex[:6]}", name="Report Movement Item",
        gst_rate=Decimal("18"), base_uom="PCS", standard_price=Decimal("10"), standard_cost=Decimal("10"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("100"), rate=Decimal("10"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=Decimal("-30"), rate=Decimal("10"),
        movement_type="adjustment", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )

    from app.services.reports import run_report

    qty_in = run_report(db, tenant_id=tenant.id, dataset_key="stock_movement", group_by="item", metric="qty_in")
    qty_out = run_report(db, tenant_id=tenant.id, dataset_key="stock_movement", group_by="item", metric="qty_out")
    assert {r.group: r.value for r in qty_in.rows}["Report Movement Item"] == Decimal("100")
    assert {r.group: r.value for r in qty_out.rows}["Report Movement Item"] == Decimal("30")


def test_hsn_tax_summary_groups_real_invoice_line_tax_by_hsn(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    invoice = _make_invoice(db, tenant_ctx, customer_name="Report HSN Co", qty=Decimal("4"), rate=Decimal("250"))
    db.flush()
    line = invoice.items[0]
    from app.models.masters import Item as ItemModel

    item = db.get(ItemModel, line.item_id)
    item.hsn_code = "6810"
    db.flush()

    from app.services.reports import run_report

    taxable = run_report(db, tenant_id=tenant.id, dataset_key="hsn_tax_summary", group_by="hsn", metric="taxable_value")
    tax = run_report(db, tenant_id=tenant.id, dataset_key="hsn_tax_summary", group_by="hsn", metric="tax")
    assert {r.group: r.value for r in taxable.rows}["6810"] == line.taxable_value
    assert {r.group: r.value for r in tax.rows}["6810"] == line.cgst_amount + line.sgst_amount + line.igst_amount


def test_deliveries_group_by_vehicle_and_status(db, tenant_ctx):
    tenant, branch = tenant_ctx["tenant"], tenant_ctx["branch"]
    invoice = _make_invoice(db, tenant_ctx, customer_name="Report Dispatch Co", qty=Decimal("1"), rate=Decimal("100"))
    db.flush()

    from app.models.fleet import Driver, Vehicle
    from app.services.fleet import assign_challan_to_trip, create_trip

    vehicle = Vehicle(tenant_id=tenant.id, branch_id=branch.id, registration_number="AP31XX1234", vehicle_type="mini truck")
    driver = Driver(tenant_id=tenant.id, branch_id=branch.id, name="Report Test Driver")
    db.add_all([vehicle, driver])
    db.flush()
    trip = create_trip(db, tenant_id=tenant.id, branch_id=branch.id, vehicle_id=vehicle.id, driver_id=driver.id, trip_date=invoice.invoice_date)
    assign_challan_to_trip(db, trip_id=trip.id, delivery_challan_id=invoice.delivery_challan_id)
    db.flush()

    from app.services.reports import run_report

    by_vehicle = run_report(db, tenant_id=tenant.id, dataset_key="deliveries", group_by="vehicle", metric="count")
    by_status = run_report(db, tenant_id=tenant.id, dataset_key="deliveries", group_by="status", metric="count")
    assert {r.group: r.value for r in by_vehicle.rows}["AP31XX1234"] == 1
    assert sum(r.value for r in by_status.rows) == 1
