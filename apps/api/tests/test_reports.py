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


def test_reports_datasets_lists_only_permitted_datasets():
    slug = f"rpt-ds-{uuid.uuid4().hex[:8]}"
    token = _signed_up_token(slug)
    resp = client.get("/api/v1/reports/datasets", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    keys = {d["key"] for d in resp.json()}
    # Owner role has every resource -- all 4 datasets should be visible.
    assert keys == {"sales_invoices", "purchase_bills", "customer_outstanding", "item_stock"}


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
    assert keys == {"item_stock"}

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
