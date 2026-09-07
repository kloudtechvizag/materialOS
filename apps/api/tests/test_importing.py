"""Slice 0 acceptance test (service-level): a Tally masters export loads
and the resulting customer/supplier opening balances plus item opening
stock reconcile exactly, with stock_balance matching a fresh ledger replay.
"""

import uuid
from decimal import Decimal

from app.models.importing import ImportBatch
from app.models.inventory import StockBalance
from app.models.masters import Customer, Item, Supplier
from app.models.tenant import Warehouse
from app.services.importing import pipeline
from app.services.inventory import assert_no_drift

TALLY_XML = b"""<ENVELOPE>
<BODY><IMPORTDATA><REQUESTDATA>
<TALLYMESSAGE>
  <LEDGER NAME="Ramesh Kumar">
    <PARENT>Sundry Debtors</PARENT>
    <OPENINGBALANCE>15000.00</OPENINGBALANCE>
    <PARTYGSTIN>37ABCDE1234F1Z5</PARTYGSTIN>
    <LEDGERMOBILE>9876543210</LEDGERMOBILE>
  </LEDGER>
</TALLYMESSAGE>
<TALLYMESSAGE>
  <LEDGER NAME="Steel Supplies Co">
    <PARENT>Sundry Creditors</PARENT>
    <OPENINGBALANCE>42000.50</OPENINGBALANCE>
  </LEDGER>
</TALLYMESSAGE>
<TALLYMESSAGE>
  <STOCKITEM NAME="ACC PPC 50KG">
    <PARENT>Cement</PARENT>
    <BASEUNITS>BAGS</BASEUNITS>
    <GSTHSNCODE>2523</GSTHSNCODE>
    <GSTRATE>18</GSTRATE>
    <OPENINGBALANCE>500 BAGS</OPENINGBALANCE>
    <OPENINGRATE>350.00/BAGS</OPENINGRATE>
  </STOCKITEM>
</TALLYMESSAGE>
</REQUESTDATA></IMPORTDATA></BODY>
</ENVELOPE>
"""


def _make_batch(db, tenant_ctx) -> ImportBatch:
    batch = ImportBatch(
        tenant_id=tenant_ctx["tenant"].id,
        company_id=tenant_ctx["company"].id,
        source_type="tally_xml",
        status="uploaded",
        file_name="export.xml",
        storage_path="unused-in-test",
        uploaded_by_user_id=uuid.uuid4(),
    )
    db.add(batch)
    db.flush()
    return batch


def test_tally_import_reconciles_opening_balances_and_stock(db, tenant_ctx):
    batch = _make_batch(db, tenant_ctx)
    warehouse = Warehouse(tenant_id=tenant_ctx["tenant"].id, branch_id=tenant_ctx["branch"].id, name="Main Godown", code="MAIN")
    db.add(warehouse)
    db.flush()

    pipeline.stage_tally_xml(db, batch, TALLY_XML)
    assert batch.status == "mapped"

    pipeline.validate_batch(db, batch)
    assert batch.status == "validated"
    assert batch.error_report["invalid_row_count"] == 0

    preview = pipeline.build_preview(db, batch)
    assert preview["counts_by_row_type"] == {"customer": 1, "supplier": 1, "item": 1}
    assert preview["invalid_row_count"] == 0
    assert batch.status == "previewed"

    result = pipeline.commit_batch(
        db, batch, company_id=tenant_ctx["company"].id, default_warehouse_id=warehouse.id, user_id=uuid.uuid4()
    )
    assert batch.status == "committed"
    assert result == {
        "customers_created": 1,
        "suppliers_created": 1,
        "items_created": 1,
        "opening_stock_lines": 1,
    }

    customer = db.query(Customer).filter(Customer.tenant_id == tenant_ctx["tenant"].id).one()
    assert customer.name == "Ramesh Kumar"
    assert customer.opening_balance == Decimal("15000.0000")
    assert customer.gstin == "37ABCDE1234F1Z5"

    supplier = db.query(Supplier).filter(Supplier.tenant_id == tenant_ctx["tenant"].id).one()
    assert supplier.name == "Steel Supplies Co"
    assert supplier.opening_balance == Decimal("42000.5000")

    item = db.query(Item).filter(Item.tenant_id == tenant_ctx["tenant"].id).one()
    assert item.name == "ACC PPC 50KG"
    assert item.hsn_code == "2523"
    assert item.gst_rate == Decimal("18.00")

    balance = (
        db.query(StockBalance)
        .filter(StockBalance.tenant_id == tenant_ctx["tenant"].id, StockBalance.item_id == item.id)
        .one()
    )
    assert balance.qty_on_hand == Decimal("500.0000")

    # B3: the projection must match a fresh replay of the ledger.
    assert_no_drift(db, tenant_id=tenant_ctx["tenant"].id)


def test_cement_at_stale_gst_rate_is_flagged_but_not_blocking(db, tenant_ctx):
    stale_xml = TALLY_XML.replace(b"<GSTRATE>18</GSTRATE>", b"<GSTRATE>28</GSTRATE>")
    batch = _make_batch(db, tenant_ctx)

    pipeline.stage_tally_xml(db, batch, stale_xml)
    pipeline.validate_batch(db, batch)

    from app.models.importing import ImportBatchRow

    item_row = (
        db.query(ImportBatchRow)
        .filter(ImportBatchRow.import_batch_id == batch.id, ImportBatchRow.row_type == "item")
        .one()
    )
    assert item_row.is_valid, "a stale GST rate should warn, not block the import"
    warning_messages = [e["message"] for e in item_row.validation_errors if e["level"] == "warning"]
    assert any("18%" in m for m in warning_messages)
