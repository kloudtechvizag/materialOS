"""Slice 2 acceptance test, from Master Brief v2: "a full day's dispatch
runs on the app with no paper challan, and physical count matches book
stock after a blind count of one godown."
"""

import uuid
from decimal import Decimal

from app.models.fleet import Driver, ProofOfDelivery, Trip, Vehicle
from app.models.masters import Customer, Item
from app.models.sales import DeliveryChallan
from app.models.tenant import Warehouse
from app.services.credit import compute_outstanding
from app.services.dispatch import create_delivery_challan
from app.services.fleet import assign_challan_to_trip, capture_pod, create_trip, start_trip
from app.services.inventory import apply_ledger_movement, assert_no_drift
from app.services.invoicing import create_invoice_from_challan
from app.services.quotation import create_quotation
from app.services.sales_order import create_sales_order_from_quotation
from app.services.sales_return import create_sales_return
from app.services.stock_count import approve_stock_count, start_stock_count, submit_stock_count
from app.services.transfers import create_transfer, dispatch_transfer, receive_transfer


def _make_customer_and_item(db, tenant_ctx, *, opening_qty=Decimal("1000")):
    tenant, company, warehouse = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["warehouse"]
    user_id = uuid.uuid4()
    customer = Customer(
        tenant_id=tenant.id, company_id=company.id, name="Test Customer", billing_state="Andhra Pradesh",
        credit_limit=Decimal("5000000"),
    )
    db.add(customer)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"SKU-{uuid.uuid4().hex[:6]}", name="Test Item",
        hsn_code="2523", gst_rate=Decimal("18"), base_uom="BAG", standard_price=Decimal("100"), standard_cost=Decimal("80"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=opening_qty, rate=Decimal("80"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=user_id,
    )
    return customer, item, user_id


def _invoice_for(db, tenant_ctx, customer, item, qty, user_id):
    tenant, company, branch, warehouse, fy = (
        tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["warehouse"], tenant_ctx["financial_year"],
    )
    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": qty, "uom": item.base_uom}],
    )
    quotation.status = "approved"
    db.flush()
    order = create_sales_order_from_quotation(
        db, tenant_id=tenant.id, quotation_id=quotation.id, warehouse_id=warehouse.id, financial_year_id=fy.id,
        requested_by_user_id=user_id,
    )
    challan = create_delivery_challan(db, tenant_id=tenant.id, sales_order_id=order.id, financial_year_id=fy.id, user_id=user_id)
    invoice = create_invoice_from_challan(db, tenant_id=tenant.id, delivery_challan_id=challan.id, financial_year_id=fy.id)
    return order, challan, invoice


def test_full_day_dispatch_via_trip_and_pod(db, tenant_ctx):
    tenant, branch = tenant_ctx["tenant"], tenant_ctx["branch"]
    customer, item, user_id = _make_customer_and_item(db, tenant_ctx)
    _, challan, _ = _invoice_for(db, tenant_ctx, customer, item, Decimal("50"), user_id)

    vehicle = Vehicle(tenant_id=tenant.id, branch_id=branch.id, registration_number="AP31AB1234", vehicle_type="mini truck")
    driver = Driver(tenant_id=tenant.id, branch_id=branch.id, name="Test Driver", phone="9876543210")
    db.add_all([vehicle, driver])
    db.flush()

    from datetime import date

    trip = create_trip(db, tenant_id=tenant.id, branch_id=branch.id, vehicle_id=vehicle.id, driver_id=driver.id, trip_date=date.today())
    assign_challan_to_trip(db, trip_id=trip.id, delivery_challan_id=challan.id)
    db.refresh(challan)
    assert challan.trip_id == trip.id

    start_trip(db, trip_id=trip.id)
    db.refresh(challan)
    assert challan.status == "in_transit"

    pod = capture_pod(
        db, tenant_id=tenant.id, delivery_challan_id=challan.id, receiver_name="Site Supervisor",
        signature_data_url="data:image/png;base64,fake", photo_path=None,
        latitude=Decimal("17.686800"), longitude=Decimal("83.218500"), status="delivered", shortage_notes=None,
    )
    assert pod.receiver_name == "Site Supervisor"

    db.refresh(challan)
    assert challan.status == "delivered"
    db.refresh(trip)
    assert trip.status == "completed"  # no paper challan: the trip closes itself once every leg is delivered


def test_blind_stock_count_variance_and_adjustment(db, tenant_ctx):
    tenant, warehouse = tenant_ctx["tenant"], tenant_ctx["warehouse"]
    _, item, user_id = _make_customer_and_item(db, tenant_ctx, opening_qty=Decimal("500"))

    count = start_stock_count(db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_ids=[item.id], counted_by_user_id=user_id)
    assert count.items[0].system_qty == Decimal("500")

    # Blind count finds 12 fewer bags than the book.
    submit_stock_count(db, count_id=count.id, counted_quantities={str(item.id): Decimal("488")})
    approve_stock_count(db, tenant_id=tenant.id, count_id=count.id, approved_by_user_id=user_id)

    assert_no_drift(db, tenant_id=tenant.id)

    from app.models.inventory import StockBalance

    balance = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == warehouse.id, StockBalance.item_id == item.id
    ).one()
    assert balance.qty_on_hand == Decimal("488")


def test_warehouse_transfer_moves_stock_between_warehouses(db, tenant_ctx):
    tenant, company, branch, fy = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["financial_year"]
    _, item, user_id = _make_customer_and_item(db, tenant_ctx, opening_qty=Decimal("200"))

    second_warehouse = Warehouse(tenant_id=tenant.id, branch_id=branch.id, name="Second Godown", code="SEC-WH")
    db.add(second_warehouse)
    db.flush()

    transfer = create_transfer(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        from_warehouse_id=tenant_ctx["warehouse"].id, to_warehouse_id=second_warehouse.id,
        lines=[{"item_id": item.id, "qty": Decimal("60")}],
    )
    dispatch_transfer(db, tenant_id=tenant.id, transfer_id=transfer.id, user_id=user_id)
    receive_transfer(db, tenant_id=tenant.id, transfer_id=transfer.id, user_id=user_id)

    assert_no_drift(db, tenant_id=tenant.id)

    from app.models.inventory import StockBalance

    source = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == tenant_ctx["warehouse"].id, StockBalance.item_id == item.id
    ).one()
    dest = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == second_warehouse.id, StockBalance.item_id == item.id
    ).one()
    assert source.qty_on_hand == Decimal("140")
    assert dest.qty_on_hand == Decimal("60")


def test_sales_return_reverses_stock_and_outstanding(db, tenant_ctx):
    from sqlalchemy import text

    tenant, company, branch, fy = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["financial_year"]
    customer, item, user_id = _make_customer_and_item(db, tenant_ctx, opening_qty=Decimal("100"))
    _, _, invoice = _invoice_for(db, tenant_ctx, customer, item, Decimal("20"), user_id)

    outstanding_before = compute_outstanding(db, customer.id)

    from app.models.sales import InvoiceItem

    invoice_item = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).one()

    sales_return = create_sales_return(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        invoice_id=invoice.id, warehouse_id=tenant_ctx["warehouse"].id, reason="Excess delivered",
        lines=[{"invoice_item_id": invoice_item.id, "qty": Decimal("5")}], user_id=user_id,
    )
    db.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))

    assert_no_drift(db, tenant_id=tenant.id)

    outstanding_after = compute_outstanding(db, customer.id)
    assert outstanding_after == outstanding_before - sales_return.total

    from app.models.inventory import StockBalance

    balance = db.query(StockBalance).filter(
        StockBalance.tenant_id == tenant.id, StockBalance.warehouse_id == tenant_ctx["warehouse"].id, StockBalance.item_id == item.id
    ).one()
    # 100 opening - 20 dispatched + 5 returned = 85
    assert balance.qty_on_hand == Decimal("85")
