"""Slice 6 acceptance tests: customer portal scoping, the credit-limit
approval workflow (ADR-009), and the notification centre.
"""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.db import set_session_context
from app.errors import AppError, ErrorCode
from app.models.masters import Customer, Item
from app.services.approvals import decide_request, ensure_default_approval_rules
from app.services.inventory import apply_ledger_movement
from app.services.notifications import list_notifications, mark_read, unread_count
from app.services.portal import (
    create_portal_login,
    decide_quotation,
    get_quotation,
    list_quotations,
    submit_payment_intimation,
)
from app.services.quotation import create_quotation
from app.services.sales_order import create_sales_order_from_quotation
from app.models.approvals import ApprovalRequest


def _customer(db, tenant_ctx, *, credit_limit):
    tenant, company = tenant_ctx["tenant"], tenant_ctx["company"]
    customer = Customer(
        tenant_id=tenant.id, company_id=company.id, name="Slice6 Co", billing_state="Andhra Pradesh",
        credit_limit=credit_limit,
    )
    db.add(customer)
    db.flush()
    return customer


def _item(db, tenant_ctx, *, opening_qty=Decimal("1000")):
    tenant, warehouse, company = tenant_ctx["tenant"], tenant_ctx["warehouse"], tenant_ctx["company"]
    item = Item(
        tenant_id=tenant.id, company_id=company.id, sku=f"SKU-{uuid.uuid4().hex[:6]}", name="Test Item",
        hsn_code="2523", gst_rate=Decimal("18"), base_uom="BAG", standard_price=Decimal("100"), standard_cost=Decimal("80"),
    )
    db.add(item)
    db.flush()
    apply_ledger_movement(
        db, tenant_id=tenant.id, warehouse_id=warehouse.id, item_id=item.id, qty=opening_qty, rate=Decimal("80"),
        movement_type="opening", reference_type="test", reference_id=uuid.uuid4(), user_id=uuid.uuid4(),
    )
    return item


def _commit_and_restore_context(db, tenant_ctx):
    """request_approval commits through its own session so the pending
    request survives the caller's rollback (see services/approvals.py) --
    which means anything it needs to see (tenant, rule, quotation) must be
    committed here too. app.current_tenant is transaction-local (B9), so a
    commit clears it on this session; put it back before continuing.
    """
    db.commit()
    set_session_context(db, tenant_id=str(tenant_ctx["tenant"].id), user_id=None)


def _approved_quotation(db, tenant_ctx, customer, item, *, qty):
    tenant, company, branch, fy = tenant_ctx["tenant"], tenant_ctx["company"], tenant_ctx["branch"], tenant_ctx["financial_year"]
    quotation = create_quotation(
        db, tenant_id=tenant.id, company_id=company.id, branch_id=branch.id, financial_year_id=fy.id,
        customer_id=customer.id, project_id=None, site_id=None, site_state=None, valid_until=None,
        lines=[{"item_id": item.id, "qty": qty, "uom": item.base_uom}],
    )
    quotation.status = "approved"
    db.flush()
    return quotation


def test_blocked_order_creates_pending_approval_and_approval_unblocks_retry(db, tenant_ctx):
    ensure_default_approval_rules(db, tenant_id=tenant_ctx["tenant"].id)
    customer = _customer(db, tenant_ctx, credit_limit=Decimal("1000"))
    item = _item(db, tenant_ctx)
    quotation = _approved_quotation(db, tenant_ctx, customer, item, qty=Decimal("50"))  # 50 * 100 = 5000, over the 1000 limit
    _commit_and_restore_context(db, tenant_ctx)

    requester_id = uuid.uuid4()
    with pytest.raises(AppError) as excinfo:
        create_sales_order_from_quotation(
            db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
            warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
            requested_by_user_id=requester_id,
        )
    assert excinfo.value.code == ErrorCode.CREDIT_LIMIT_EXCEEDED
    request_id = uuid.UUID(excinfo.value.details["approval_request_id"])

    request = db.get(ApprovalRequest, request_id)
    assert request.status == "pending"
    assert request.document_type == "quotation"
    assert request.document_id == quotation.id
    assert request.requested_by_user_id == requester_id

    # A second attempt while still pending must not create a duplicate request.
    with pytest.raises(AppError):
        create_sales_order_from_quotation(
            db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
            warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
            requested_by_user_id=requester_id,
        )
    still_pending = db.execute(
        select(ApprovalRequest).where(ApprovalRequest.document_id == quotation.id)
    ).scalars().all()
    assert len(still_pending) == 1

    decider_id = uuid.uuid4()
    decide_request(db, request_id=request_id, decided_by_user_id=decider_id, approve=True)

    order = create_sales_order_from_quotation(
        db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
        warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
        requested_by_user_id=requester_id,
    )
    assert order.status == "reserved"
    assert order.total == quotation.total


def test_rejected_approval_keeps_order_blocked(db, tenant_ctx):
    ensure_default_approval_rules(db, tenant_id=tenant_ctx["tenant"].id)
    customer = _customer(db, tenant_ctx, credit_limit=Decimal("1000"))
    item = _item(db, tenant_ctx)
    quotation = _approved_quotation(db, tenant_ctx, customer, item, qty=Decimal("50"))
    _commit_and_restore_context(db, tenant_ctx)

    with pytest.raises(AppError) as excinfo:
        create_sales_order_from_quotation(
            db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
            warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
            requested_by_user_id=uuid.uuid4(),
        )
    request_id = uuid.UUID(excinfo.value.details["approval_request_id"])
    decide_request(db, request_id=request_id, decided_by_user_id=uuid.uuid4(), approve=False)

    with pytest.raises(AppError) as excinfo2:
        create_sales_order_from_quotation(
            db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
            warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
            requested_by_user_id=uuid.uuid4(),
        )
    assert excinfo2.value.code == ErrorCode.CREDIT_LIMIT_EXCEEDED


def test_portal_customer_cannot_see_another_customers_quotation(db, tenant_ctx):
    customer_a = _customer(db, tenant_ctx, credit_limit=Decimal("0"))
    customer_b = _customer(db, tenant_ctx, credit_limit=Decimal("0"))
    item = _item(db, tenant_ctx)

    quotation_a = _approved_quotation(db, tenant_ctx, customer_a, item, qty=Decimal("1"))
    quotation_b = _approved_quotation(db, tenant_ctx, customer_b, item, qty=Decimal("1"))

    assert get_quotation(db, customer_a, quotation_a.id).id == quotation_a.id

    with pytest.raises(AppError) as excinfo:
        get_quotation(db, customer_a, quotation_b.id)
    assert excinfo.value.code == ErrorCode.NOT_FOUND

    a_quotations = {q.id for q in list_quotations(db, customer_a)}
    assert quotation_a.id in a_quotations
    assert quotation_b.id not in a_quotations


def test_portal_quotation_decision_and_payment_intimation(db, tenant_ctx):
    customer = _customer(db, tenant_ctx, credit_limit=Decimal("0"))
    item = _item(db, tenant_ctx)
    quotation = _approved_quotation(db, tenant_ctx, customer, item, qty=Decimal("2"))
    quotation.status = "sent"
    db.flush()

    decided = decide_quotation(db, customer, quotation.id, approve=True)
    assert decided.status == "approved"

    with pytest.raises(AppError):
        decide_quotation(db, customer, quotation.id, approve=True)  # already decided, no longer "sent"

    receipt = submit_payment_intimation(db, customer, amount=Decimal("100"), mode="upi", reference_note="UTR123")
    assert receipt.customer_id == customer.id
    assert receipt.amount == Decimal("100")
    assert "Customer portal intimation" in receipt.reference_note


def test_create_portal_login_scopes_user_to_customer(db, tenant_ctx):
    customer = _customer(db, tenant_ctx, credit_limit=Decimal("0"))
    user = create_portal_login(
        db, tenant_id=tenant_ctx["tenant"].id, customer=customer,
        email=f"portal-{uuid.uuid4().hex[:6]}@example.com", password="hunter2pass", full_name="Portal User",
    )
    assert user.customer_id == customer.id


def test_notifications_created_read_and_counted(db, tenant_ctx):
    ensure_default_approval_rules(db, tenant_id=tenant_ctx["tenant"].id)
    customer = _customer(db, tenant_ctx, credit_limit=Decimal("100"))
    item = _item(db, tenant_ctx)
    quotation = _approved_quotation(db, tenant_ctx, customer, item, qty=Decimal("2"))  # 2 * 100 = 200, over the 100 limit
    _commit_and_restore_context(db, tenant_ctx)

    with pytest.raises(AppError):
        create_sales_order_from_quotation(
            db, tenant_id=tenant_ctx["tenant"].id, quotation_id=quotation.id,
            warehouse_id=tenant_ctx["warehouse"].id, financial_year_id=tenant_ctx["financial_year"].id,
            requested_by_user_id=uuid.uuid4(),
        )

    notifications = list_notifications(db, unread_only=True)
    assert any(n.notification_type == "approval_pending" for n in notifications)
    assert unread_count(db) >= 1

    mark_read(db, notifications[0].id)
    assert notifications[0].is_read is True
