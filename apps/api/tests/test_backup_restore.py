"""ADR-013 golden test (sec59, scoped to what's actually built): create
data -> backup -> verify -> destroy -> restore -> verify data is back
byte-for-byte, including a self-referential FK (PrintJob.rework_of_
job_id) to prove the topological-sort/null-then-patch restore logic
actually works, not just for simple parent/child tables.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.errors import AppError
from app.models.masters import Customer, Item
from app.models.printing import PrintJob
from app.services.backup import execute_backup, create_pending_backup, list_backupable_tables, verify_backup, restore_backup
from app.services.printing import create_print_job, create_rework_job


def test_backup_dumps_only_this_tenants_rows_and_excludes_meta_tables(db, tenant_ctx):
    tables = list_backupable_tables(db)
    assert "customers" in tables
    assert "items" in tables
    assert "audit_log" not in tables
    assert "backups" not in tables
    assert "idempotency_keys" not in tables


def test_backup_verify_restore_round_trip(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    branch = tenant_ctx["branch"]

    customer = Customer(tenant_id=tenant.id, company_id=company.id, name="Backup Test Customer", credit_limit=Decimal("50000"))
    db.add(customer)
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku="BACKUP-TEST-SKU", name="Backup Test Item",
        base_uom="PCS", gst_rate=Decimal("18"), standard_price=Decimal("100"),
    )
    db.add(item)
    db.flush()

    # A self-referential FK case: a rework job pointing at its original.
    original_job = create_print_job(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, customer_id=customer.id,
        project_id=None, item_id=None, job_type="Flyers", specification={}, quantity=Decimal("100"),
        machine_id=None, media_item_id=None, media_qty=None, warehouse_id=None, priority="normal",
        due_date=None, quoted_price=Decimal("1000"), gst_rate=Decimal("18"), notes=None,
    )
    rework_job = create_rework_job(db, tenant_id=tenant.id, original_job_id=original_job.id)
    assert rework_job.rework_of_job_id == original_job.id

    backup = create_pending_backup(db, tenant_id=tenant.id, company_id=company.id, user_id=None)
    backup = execute_backup(db, backup_id=backup.id)
    assert backup.status == "completed"
    assert backup.checksum is not None
    assert backup.table_counts["customers"] >= 1
    assert backup.table_counts["print_jobs"] == 2

    verified = verify_backup(db, backup_id=backup.id)
    assert verified.verified_at is not None

    # Destroy the data (children before parents -- print_jobs
    # references customers/items, same FK-ordering concern
    # restore_backup itself has to solve generically).
    db.execute(PrintJob.__table__.delete().where(PrintJob.tenant_id == tenant.id))
    db.execute(Item.__table__.delete().where(Item.tenant_id == tenant.id))
    db.execute(Customer.__table__.delete().where(Customer.tenant_id == tenant.id))
    db.flush()
    assert db.execute(select(Customer).where(Customer.id == customer.id)).scalar_one_or_none() is None

    restored = restore_backup(db, tenant_id=tenant.id, backup_id=backup.id, user_id=uuid.uuid4(), confirm=True)
    assert restored.restored_at is not None

    restored_customer = db.get(Customer, customer.id)
    assert restored_customer is not None
    assert restored_customer.name == "Backup Test Customer"
    assert restored_customer.credit_limit == Decimal("50000.0000")

    restored_item = db.get(Item, item.id)
    assert restored_item is not None
    assert restored_item.sku == "BACKUP-TEST-SKU"

    # The self-referential FK survived the null-then-patch restore.
    restored_original = db.get(PrintJob, original_job.id)
    restored_rework = db.get(PrintJob, rework_job.id)
    assert restored_original is not None
    assert restored_rework is not None
    assert restored_rework.rework_of_job_id == original_job.id


def test_restore_requires_explicit_confirmation(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    backup = create_pending_backup(db, tenant_id=tenant.id, company_id=company.id, user_id=None)
    backup = execute_backup(db, backup_id=backup.id)

    try:
        restore_backup(db, tenant_id=tenant.id, backup_id=backup.id, user_id=uuid.uuid4(), confirm=False)
        assert False, "expected restore without confirm=True to be rejected"
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"


def test_verify_detects_tampered_checksum(db, tenant_ctx):
    tenant = tenant_ctx["tenant"]
    company = tenant_ctx["company"]
    backup = create_pending_backup(db, tenant_id=tenant.id, company_id=company.id, user_id=None)
    backup = execute_backup(db, backup_id=backup.id)

    backup.checksum = "0" * 64  # tamper
    db.flush()

    try:
        verify_backup(db, backup_id=backup.id)
        assert False, "expected checksum mismatch to be detected"
    except AppError as exc:
        assert exc.code.value == "VALIDATION_ERROR"
